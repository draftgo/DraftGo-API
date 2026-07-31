package service

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func formatNotifyType(channelId int, status int) string {
	return fmt.Sprintf("%s_%d_%d", dto.NotifyTypeChannelUpdate, channelId, status)
}

// disable & notify
func DisableChannel(channelError types.ChannelError, reason string) bool {
	return DisableChannelWithCode(channelError, reason, "", 0)
}

func DisableChannelWithCode(channelError types.ChannelError, reason string, reasonCode string, statusCode int) bool {
	common.SysLog(fmt.Sprintf("通道「%s」（#%d）发生错误，准备禁用，原因：%s", channelError.ChannelName, channelError.ChannelId, common.LocalLogPreview(reason)))

	// 检查是否启用自动禁用功能
	if !channelError.AutoBan {
		common.SysLog(fmt.Sprintf("通道「%s」（#%d）未启用自动禁用功能，跳过禁用操作", channelError.ChannelName, channelError.ChannelId))
		return false
	}

	success := model.UpdateChannelStatus(channelError.ChannelId, channelError.UsingKey, common.ChannelStatusAutoDisabled, reason)
	if success {
		registerChannelRecoveryState(channelError, reason, reasonCode, statusCode)
		model.RecordAutoDisableChannelAuditLog(channelError.ChannelId, channelError.ChannelType, channelError.ChannelName, reason, channelError.UsingKey, channelError.IsMultiKey)
		subject := fmt.Sprintf("通道「%s」（#%d）已被禁用", channelError.ChannelName, channelError.ChannelId)
		content := fmt.Sprintf("通道「%s」（#%d）已被禁用，原因：%s", channelError.ChannelName, channelError.ChannelId, reason)
		NotifyRootUser(formatNotifyType(channelError.ChannelId, common.ChannelStatusAutoDisabled), subject, content)
	}
	return success
}

func registerChannelRecoveryState(channelError types.ChannelError, reason string, reasonCode string, statusCode int) {
	channel, err := model.GetChannelById(channelError.ChannelId, true)
	if err != nil || channel == nil {
		model.LogChannelRecoveryModelError("load disabled channel", err)
		return
	}
	if reasonCode == "" {
		reasonCode = "automatic_disable"
	}
	stateName := model.ChannelRecoveryStateAutoDisabled
	if shouldParkRecovery(statusCode, reasonCode, reason) {
		stateName = model.ChannelRecoveryStateParked
	}
	now := time.Now().Unix()
	nextProbeAt := int64(0)
	if stateName != model.ChannelRecoveryStateParked {
		nextProbeAt = now + int64(20+(channel.Id%11))
	}

	keyIndexes := []int{-1}
	if channel.ChannelInfo.IsMultiKey {
		keyIndexes = keyIndexes[:0]
		for index, key := range channel.GetKeys() {
			if channelError.UsingKey != "" && key != channelError.UsingKey {
				continue
			}
			if channel.ChannelInfo.MultiKeyStatusList[index] == common.ChannelStatusAutoDisabled {
				keyIndexes = append(keyIndexes, index)
			}
		}
	}
	for _, keyIndex := range keyIndexes {
		probeAt := nextProbeAt
		if probeAt > 0 {
			probeAt += int64((keyIndex + 1) % 3)
		}
		err := model.UpsertChannelRecoveryState(&model.ChannelRecoveryState{
			ChannelId:         channel.Id,
			KeyIndex:          keyIndex,
			State:             stateName,
			DisableReasonCode: reasonCode,
			DisableReason:     reason,
			DisabledAt:        now,
			NextProbeAt:       probeAt,
			LastError:         reason,
		})
		model.LogChannelRecoveryModelError("register disabled target", err)
	}
}

func shouldParkRecovery(statusCode int, reasonCode string, reason string) bool {
	if statusCode == http.StatusRequestTimeout || statusCode == http.StatusConflict || statusCode == http.StatusTooEarly || statusCode == http.StatusTooManyRequests || statusCode >= 500 {
		return false
	}
	if statusCode == http.StatusPaymentRequired || statusCode == http.StatusUnauthorized || statusCode == http.StatusForbidden {
		return true
	}
	if statusCode >= 400 && statusCode < 500 && statusCode != http.StatusRequestTimeout && statusCode != http.StatusConflict && statusCode != http.StatusTooEarly && statusCode != http.StatusTooManyRequests {
		return true
	}
	lowerCode := strings.ToLower(reasonCode)
	lowerReason := strings.ToLower(reason)
	for _, marker := range []string{"invalid_api_key", "authentication", "permission", "insufficient", "balance", "quota_exhausted"} {
		if strings.Contains(lowerCode, marker) || strings.Contains(lowerReason, marker) {
			return true
		}
	}
	return strings.Contains(reason, "余额不足") || strings.Contains(reason, "密钥无效") || strings.Contains(reason, "权限")
}

func EnableChannel(channelId int, usingKey string, channelName string) {
	keyIndex := -1
	if channel, err := model.GetChannelById(channelId, true); err == nil && channel.ChannelInfo.IsMultiKey {
		for index, key := range channel.GetKeys() {
			if key == usingKey {
				keyIndex = index
				break
			}
		}
	}
	ClearFailure(channelId, usingKey)
	success := model.UpdateChannelStatus(channelId, usingKey, common.ChannelStatusEnabled, "")
	if success {
		model.LogChannelRecoveryModelError("mark enabled", model.MarkChannelRecoveryEnabled(channelId, keyIndex, time.Now().Unix()))
		model.InitChannelCache()
		subject := fmt.Sprintf("通道「%s」（#%d）已被启用", channelName, channelId)
		content := fmt.Sprintf("通道「%s」（#%d）已被启用", channelName, channelId)
		NotifyRootUser(formatNotifyType(channelId, common.ChannelStatusEnabled), subject, content)
	}
}

func ResetChannelRecoveryAfterConfigurationChange(channelId int) error {
	channel, err := model.GetChannelById(channelId, true)
	if err != nil {
		return err
	}
	if err := model.DeleteChannelRecoveryStates(channelId); err != nil {
		return err
	}
	now := time.Now().Unix()
	if channel.ChannelInfo.IsMultiKey {
		for keyIndex, status := range channel.ChannelInfo.MultiKeyStatusList {
			if status != common.ChannelStatusAutoDisabled {
				continue
			}
			if err := model.UpsertChannelRecoveryState(&model.ChannelRecoveryState{
				ChannelId:         channelId,
				KeyIndex:          keyIndex,
				State:             model.ChannelRecoveryStateAutoDisabled,
				DisableReasonCode: "configuration_changed",
				DisableReason:     "channel configuration changed",
				DisabledAt:        now,
				NextProbeAt:       now,
			}); err != nil {
				return err
			}
		}
		return nil
	}
	if channel.Status != common.ChannelStatusAutoDisabled {
		return nil
	}
	return model.UpsertChannelRecoveryState(&model.ChannelRecoveryState{
		ChannelId:         channelId,
		KeyIndex:          -1,
		State:             model.ChannelRecoveryStateAutoDisabled,
		DisableReasonCode: "configuration_changed",
		DisableReason:     "channel configuration changed",
		DisabledAt:        now,
		NextProbeAt:       now,
	})
}

func ShouldDisableChannel(err *types.NewAPIError) bool {
	if !common.AutomaticDisableChannelEnabled {
		return false
	}
	if err == nil {
		return false
	}
	if types.IsChannelError(err) {
		return true
	}
	if err.GetErrorCode() == types.ErrorCodeChannelStreamFirstResponseTimeout {
		return true
	}
	if types.IsSkipRetryError(err) {
		return false
	}
	if operation_setting.ShouldDisableByStatusCode(err.StatusCode) {
		return true
	}

	lowerMessage := strings.ToLower(err.Error())
	search, _ := AcSearch(lowerMessage, operation_setting.AutomaticDisableKeywords, true)
	return search
}

func ShouldEnableChannel(newAPIError *types.NewAPIError, status int) bool {
	if !common.AutomaticEnableChannelEnabled {
		return false
	}
	if newAPIError != nil {
		return false
	}
	if status != common.ChannelStatusAutoDisabled {
		return false
	}
	return true
}
