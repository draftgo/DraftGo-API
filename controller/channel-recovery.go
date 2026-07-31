package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

const (
	recoveryWorkerSlotCount = 4
	recoveryWorkerIdleDelay = 2 * time.Second
)

var recoveryWorkersOnce sync.Once

func recoveryProbeTimeout(setting *operation_setting.MonitorSetting) time.Duration {
	channelTimeout := time.Duration(common.ChannelTestDefaultTimeout) * time.Second
	recoveryTimeout := time.Duration(setting.RecoveryThresholdSeconds * float64(time.Second))
	switch {
	case channelTimeout > 0 && recoveryTimeout > 0 && channelTimeout < recoveryTimeout:
		return channelTimeout
	case recoveryTimeout > 0:
		return recoveryTimeout
	case channelTimeout > 0:
		return channelTimeout
	default:
		return 15 * time.Second
	}
}

func AutomaticallyProbeDisabledChannels() {
	recoveryWorkersOnce.Do(func() {
		go syncChannelRecoveryTargets()
		for slot := 0; slot < recoveryWorkerSlotCount; slot++ {
			go runChannelRecoveryWorker(slot)
		}
	})
}

func syncChannelRecoveryTargets() {
	for {
		if err := ensureAutoDisabledRecoveryTargets(); err != nil {
			common.SysError("channel recovery target sync failed: " + err.Error())
		}
		time.Sleep(5 * time.Minute)
	}
}

func ensureAutoDisabledRecoveryTargets() error {
	channels, err := getRecoveryProbeChannels()
	if err != nil {
		return err
	}
	now := time.Now().Unix()
	for _, channel := range channels {
		if channel == nil {
			continue
		}
		if channel.ChannelInfo.IsMultiKey {
			for keyIndex, status := range channel.ChannelInfo.MultiKeyStatusList {
				if status != common.ChannelStatusAutoDisabled {
					continue
				}
				if err := model.EnsureChannelRecoveryState(&model.ChannelRecoveryState{
					ChannelId:         channel.Id,
					KeyIndex:          keyIndex,
					State:             model.ChannelRecoveryStateAutoDisabled,
					DisableReasonCode: "legacy_auto_disabled",
					DisableReason:     "auto-disabled before recovery state initialization",
					DisabledAt:        now,
					NextProbeAt:       now + 20,
				}); err != nil {
					return err
				}
			}
			continue
		}
		if channel.Status != common.ChannelStatusAutoDisabled {
			continue
		}
		if err := model.EnsureChannelRecoveryState(&model.ChannelRecoveryState{
			ChannelId:         channel.Id,
			KeyIndex:          -1,
			State:             model.ChannelRecoveryStateAutoDisabled,
			DisableReasonCode: "legacy_auto_disabled",
			DisableReason:     "auto-disabled before recovery state initialization",
			DisabledAt:        now,
			NextProbeAt:       now + 20,
		}); err != nil {
			return err
		}
	}
	return nil
}

func getRecoveryProbeChannels() ([]*model.Channel, error) {
	autoDisabledChannels, err := model.GetAutoDisabledChannels()
	if err != nil {
		return nil, err
	}
	multiKeyChannels, err := model.GetChannelsWithAutoDisabledMultiKeys()
	if err != nil {
		return nil, err
	}
	seen := make(map[int]struct{}, len(autoDisabledChannels)+len(multiKeyChannels))
	channels := make([]*model.Channel, 0, len(autoDisabledChannels)+len(multiKeyChannels))
	for _, channel := range append(autoDisabledChannels, multiKeyChannels...) {
		if channel == nil {
			continue
		}
		if _, ok := seen[channel.Id]; ok {
			continue
		}
		seen[channel.Id] = struct{}{}
		channels = append(channels, channel)
	}
	return channels, nil
}

func runChannelRecoveryWorker(slot int) {
	owner := fmt.Sprintf("%s-recovery-%d-%s", common.NodeName, slot, common.GetRandomString(8))
	for {
		setting := operation_setting.GetMonitorSetting()
		if setting.RecoveryMode != "independent" || !common.AutomaticEnableChannelEnabled || slot >= setting.RecoveryWorkerCount {
			time.Sleep(recoveryWorkerIdleDelay)
			continue
		}

		now := time.Now().Unix()
		probeTimeout := recoveryProbeTimeout(setting)
		leaseUntil := now + int64(probeTimeout/time.Second) + 15
		acquired, err := model.AcquireChannelRecoveryWorkerSlot(slot, owner, now, leaseUntil)
		if err != nil {
			common.SysError("channel recovery worker lease failed: " + err.Error())
			time.Sleep(recoveryWorkerIdleDelay)
			continue
		}
		if !acquired {
			time.Sleep(recoveryWorkerIdleDelay)
			continue
		}

		state, claimErr := claimDueChannelRecoveryState(owner, now, leaseUntil)
		if claimErr != nil {
			common.SysError("channel recovery target lease failed: " + claimErr.Error())
		}
		if state != nil {
			runChannelRecoveryProbe(state, owner, probeTimeout)
		}
		model.LogChannelRecoveryModelError("release worker lease", model.ReleaseChannelRecoveryWorkerSlot(slot, owner))
		if state == nil {
			time.Sleep(recoveryWorkerIdleDelay)
		}
	}
}

func claimDueChannelRecoveryState(owner string, now int64, leaseUntil int64) (*model.ChannelRecoveryState, error) {
	states, err := model.ListDueChannelRecoveryStates(now, 8)
	if err != nil {
		return nil, err
	}
	for _, state := range states {
		acquired, err := model.AcquireChannelRecoveryLease(state.ChannelId, state.KeyIndex, owner, now, leaseUntil)
		if err != nil {
			return nil, err
		}
		if acquired {
			state.LeaseOwner = owner
			state.LeaseUntil = leaseUntil
			return state, nil
		}
	}
	return nil, nil
}

func recoveryTargetIsAutoDisabled(channel *model.Channel, keyIndex int) bool {
	if channel == nil {
		return false
	}
	if keyIndex < 0 {
		return channel.Status == common.ChannelStatusAutoDisabled
	}
	if !channel.ChannelInfo.IsMultiKey {
		return false
	}
	return channel.ChannelInfo.MultiKeyStatusList[keyIndex] == common.ChannelStatusAutoDisabled
}

func runChannelRecoveryProbe(state *model.ChannelRecoveryState, owner string, timeout time.Duration) {
	defer model.LogChannelRecoveryModelError("release target lease", model.ReleaseChannelRecoveryLease(state.ChannelId, state.KeyIndex, owner))
	channel, err := model.GetChannelById(state.ChannelId, true)
	if err != nil {
		if model.IsChannelRecoveryNotFound(err) {
			model.LogChannelRecoveryModelError("delete orphan target", model.DeleteChannelRecoveryState(state.ChannelId, state.KeyIndex))
			return
		}
		common.SysError("channel recovery load channel failed: " + err.Error())
		return
	}
	if !recoveryTargetIsAutoDisabled(channel, state.KeyIndex) {
		model.LogChannelRecoveryModelError("mark stale target enabled", model.MarkChannelRecoveryEnabled(state.ChannelId, state.KeyIndex, time.Now().Unix()))
		return
	}

	probeUserID, err := resolveChannelTestUserID(nil)
	if err != nil {
		common.SysError("channel recovery resolve probe user failed: " + err.Error())
		return
	}
	options := channelTestOptions{
		recoveryProbe: true,
		timeout:       timeout,
	}
	if state.KeyIndex >= 0 {
		keyIndex := state.KeyIndex
		options.forcedMultiKeyIndex = &keyIndex
	}
	startedAt := time.Now()
	result := testChannel(context.Background(), channel, probeUserID, "", "", true, common.ChannelTestDefaultTimeout, options)
	latencyMs := time.Since(startedAt).Milliseconds()
	applyChannelRecoveryProbeResult(channel, state, owner, result, latencyMs)
}

func applyChannelRecoveryProbeResult(channel *model.Channel, state *model.ChannelRecoveryState, owner string, result testResult, latencyMs int64) {
	setting := operation_setting.GetMonitorSetting()
	now := time.Now().Unix()
	update := model.ChannelRecoveryProbeUpdate{
		LastProbeAt:            now,
		LastLatencyMs:          latencyMs,
		FailureStreak:          state.FailureStreak,
		SuccessStreak:          state.SuccessStreak,
		SoftBudgetNotifiedDate: state.SoftBudgetNotifiedDate,
		LastCancelReason:       result.cancelReason,
	}
	errorCode := ""
	if result.newAPIError != nil {
		errorCode = string(result.newAPIError.GetErrorCode())
		update.LastError = result.newAPIError.Error()
	} else if result.localErr != nil {
		update.LastError = result.localErr.Error()
	}

	shouldEnable := false
	budgetNotification := false
	if result.localErr == nil && result.newAPIError == nil {
		update.FailureStreak = 0
		update.SuccessStreak++
		requiredSuccesses := setting.RecoveryProbeCount
		if requiredSuccesses < 2 {
			requiredSuccesses = 2
		}
		if state.State == model.ChannelRecoveryStateProbation && update.SuccessStreak >= requiredSuccesses {
			update.State = model.ChannelRecoveryStateEnabled
			update.NextProbeAt = 0
			shouldEnable = true
		} else {
			update.State = model.ChannelRecoveryStateProbation
			update.NextProbeAt = now + int64(setting.RecoveryProbationSeconds)
		}
	} else if recoveryProbeShouldPark(result) {
		update.State = model.ChannelRecoveryStateParked
		update.FailureStreak++
		update.SuccessStreak = 0
		update.NextProbeAt = 0
		if update.LastCancelReason == "" {
			update.LastCancelReason = "parked_error"
		}
	} else {
		update.FailureStreak++
		update.SuccessStreak = 0
		if state.State == model.ChannelRecoveryStateProbation {
			update.DisabledAt = now
			state.DisabledAt = now
		}
		update.State, update.NextProbeAt = nextFailedRecoveryProbe(channel, state, setting, now, update.FailureStreak)
	}

	today := time.Unix(now, 0).Format("2006-01-02")
	dailyCount := state.DailyProbeCount
	if state.ProbeCountDate != today {
		dailyCount = 0
	}
	if dailyCount+1 >= setting.RecoveryDailyProbeBudget && update.State != model.ChannelRecoveryStateEnabled && update.State != model.ChannelRecoveryStateParked {
		// Keep probation so a later successful round can still enable the
		// channel. The soft budget changes cadence, not recovery semantics.
		if update.State != model.ChannelRecoveryStateProbation {
			update.State = model.ChannelRecoveryStateWatching
		}
		update.NextProbeAt = now + int64(maxRecoveryInterval(channel, setting)/time.Second)
		if state.SoftBudgetNotifiedDate != today {
			update.SoftBudgetNotifiedDate = today
			budgetNotification = true
		}
	}

	updated, err := model.UpdateChannelRecoveryProbe(state.ChannelId, state.KeyIndex, owner, update)
	if err != nil {
		common.SysError("channel recovery result update failed: " + err.Error())
		return
	}
	if budgetNotification {
		service.NotifyRootUser("channel_recovery_probe_budget", "恢复探测达到每日软预算", fmt.Sprintf("通道「%s」（#%d）的恢复探测已切换到最大间隔", channel.Name, channel.Id))
		logger.LogWarn(context.Background(), fmt.Sprintf("recovery probe soft budget reached: channel_id=%d key_index=%d daily_count=%d", channel.Id, state.KeyIndex, updated.DailyProbeCount))
	}
	model.RecordRecoveryProbeAuditLog(model.RecoveryProbeAuditParams{
		ChannelId:    channel.Id,
		ChannelName:  channel.Name,
		KeyIndex:     state.KeyIndex,
		State:        updated.State,
		NextProbeAt:  updated.NextProbeAt,
		LatencyMs:    latencyMs,
		CancelReason: update.LastCancelReason,
		ErrorCode:    errorCode,
		ErrorMessage: update.LastError,
	})
	if shouldEnable {
		usingKey := ""
		if state.KeyIndex >= 0 {
			keys := channel.GetKeys()
			if state.KeyIndex < len(keys) {
				usingKey = keys[state.KeyIndex]
			}
		}
		service.EnableChannel(channel.Id, usingKey, channel.Name)
	}
}

func recoveryProbeShouldPark(result testResult) bool {
	if errors.Is(result.localErr, errUnsafeAutomaticRecoveryProbe) || !result.upstreamSent {
		return true
	}
	if result.newAPIError == nil {
		return false
	}
	status := result.newAPIError.StatusCode
	if status == http.StatusPaymentRequired || status == http.StatusUnauthorized || status == http.StatusForbidden {
		return true
	}
	return status >= 400 && status < 500 && status != http.StatusRequestTimeout && status != http.StatusConflict && status != http.StatusTooEarly && status != http.StatusTooManyRequests
}

func nextFailedRecoveryProbe(channel *model.Channel, state *model.ChannelRecoveryState, setting *operation_setting.MonitorSetting, now int64, failureStreak int) (string, int64) {
	age := time.Duration(now-state.DisabledAt) * time.Second
	if age < 3*time.Minute {
		jitterSeconds := int64((channel.Id + state.KeyIndex + failureStreak) % 11)
		if jitterSeconds < 0 {
			jitterSeconds = -jitterSeconds
		}
		return model.ChannelRecoveryStateFastProbing, now + 20 + jitterSeconds
	}
	if age < 15*time.Minute {
		return model.ChannelRecoveryStateFastProbing, now + 60
	}
	return model.ChannelRecoveryStateWatching, now + int64(maxRecoveryInterval(channel, setting)/time.Second)
}

func maxRecoveryInterval(channel *model.Channel, setting *operation_setting.MonitorSetting) time.Duration {
	if channel.GetPriority() >= setting.RecoveryHighPriorityThreshold {
		return time.Duration(setting.RecoveryHighPriorityMinutes * float64(time.Minute))
	}
	return time.Duration(setting.RecoveryProbeMinutes * float64(time.Minute))
}

func GetChannelRecoveryStates(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	channelId, _ := strconv.Atoi(c.Query("channel_id"))
	state := strings.TrimSpace(c.Query("state"))
	items, total, err := model.ListChannelRecoveryStates(page, pageSize, state, channelId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	counts, err := model.CountChannelRecoveryStates()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items":     items,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
			"counts":    counts,
		},
	})
}

func ProbeChannelRecoveryNow(c *gin.Context) {
	mutateChannelRecoveryFromRequest(c, false)
}

func ResetChannelRecovery(c *gin.Context) {
	mutateChannelRecoveryFromRequest(c, true)
}

func mutateChannelRecoveryFromRequest(c *gin.Context, reset bool) {
	channelId, err := strconv.Atoi(c.Param("channel_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	keyIndex, err := strconv.Atoi(c.Param("key_index"))
	if err != nil || keyIndex < -1 {
		common.ApiError(c, fmt.Errorf("invalid key_index"))
		return
	}
	now := time.Now().Unix()
	var changed bool
	if reset {
		changed, err = model.ResetChannelRecoveryState(channelId, keyIndex, "manual_reset", now)
	} else {
		changed, err = model.ScheduleChannelRecoveryProbeNow(channelId, keyIndex, now)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !changed {
		recoveryState, stateErr := model.GetChannelRecoveryState(channelId, keyIndex)
		if model.IsChannelRecoveryNotFound(stateErr) {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "recovery state not found"})
			return
		}
		if stateErr != nil {
			common.ApiError(c, stateErr)
			return
		}
		if recoveryState.LeaseUntil >= now {
			c.JSON(http.StatusConflict, gin.H{"success": false, "message": "recovery probe is already running"})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
