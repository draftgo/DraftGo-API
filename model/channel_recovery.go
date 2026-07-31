package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	ChannelRecoveryStateAutoDisabled = "auto_disabled"
	ChannelRecoveryStateFastProbing  = "fast_probing"
	ChannelRecoveryStateWatching     = "watching"
	ChannelRecoveryStateProbation    = "probation"
	ChannelRecoveryStateEnabled      = "enabled"
	ChannelRecoveryStateParked       = "parked"
)

type ChannelRecoveryState struct {
	Id                     int    `json:"id"`
	ChannelId              int    `json:"channel_id" gorm:"uniqueIndex:idx_channel_recovery_target,priority:1;index"`
	KeyIndex               int    `json:"key_index" gorm:"uniqueIndex:idx_channel_recovery_target,priority:2"`
	State                  string `json:"state" gorm:"type:varchar(32);index"`
	DisableReasonCode      string `json:"disable_reason_code" gorm:"type:varchar(128)"`
	DisableReason          string `json:"disable_reason" gorm:"type:text"`
	FailureStreak          int    `json:"failure_streak"`
	SuccessStreak          int    `json:"success_streak"`
	DisabledAt             int64  `json:"disabled_at" gorm:"bigint"`
	NextProbeAt            int64  `json:"next_probe_at" gorm:"bigint;index"`
	LastProbeAt            int64  `json:"last_probe_at" gorm:"bigint"`
	LastLatencyMs          int64  `json:"last_latency_ms" gorm:"bigint"`
	DailyProbeCount        int    `json:"daily_probe_count"`
	ProbeCountDate         string `json:"probe_count_date" gorm:"type:varchar(10)"`
	LeaseUntil             int64  `json:"lease_until" gorm:"bigint;index"`
	LeaseOwner             string `json:"lease_owner" gorm:"type:varchar(192)"`
	LastError              string `json:"last_error" gorm:"type:text"`
	LastCancelReason       string `json:"last_cancel_reason" gorm:"type:varchar(64)"`
	SoftBudgetNotifiedDate string `json:"soft_budget_notified_date" gorm:"type:varchar(10)"`
	UpdatedAt              int64  `json:"updated_at" gorm:"bigint;autoUpdateTime"`
}

type ChannelRecoveryWorkerLease struct {
	Slot       int    `json:"slot" gorm:"primaryKey;autoIncrement:false"`
	LeaseUntil int64  `json:"lease_until" gorm:"bigint;index"`
	LeaseOwner string `json:"lease_owner" gorm:"type:varchar(192)"`
	UpdatedAt  int64  `json:"updated_at" gorm:"bigint;autoUpdateTime"`
}

type ChannelRecoveryListItem struct {
	ChannelRecoveryState
	ChannelName     string `json:"channel_name"`
	ChannelType     int    `json:"channel_type"`
	ChannelStatus   int    `json:"channel_status"`
	ChannelPriority int64  `json:"channel_priority"`
}

type ChannelRecoveryProbeUpdate struct {
	State                  string
	FailureStreak          int
	SuccessStreak          int
	NextProbeAt            int64
	LastProbeAt            int64
	LastLatencyMs          int64
	LastError              string
	LastCancelReason       string
	SoftBudgetNotifiedDate string
	DisabledAt             int64
}

func UpsertChannelRecoveryState(state *ChannelRecoveryState) error {
	if state == nil {
		return errors.New("channel recovery state is nil")
	}
	if state.KeyIndex < -1 {
		return errors.New("channel recovery key index is invalid")
	}
	now := time.Now().Unix()
	if state.DisabledAt == 0 {
		state.DisabledAt = now
	}
	if state.NextProbeAt == 0 {
		state.NextProbeAt = now
	}
	state.UpdatedAt = now
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "channel_id"}, {Name: "key_index"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"state":                     state.State,
			"disable_reason_code":       state.DisableReasonCode,
			"disable_reason":            state.DisableReason,
			"failure_streak":            0,
			"success_streak":            0,
			"disabled_at":               state.DisabledAt,
			"next_probe_at":             state.NextProbeAt,
			"lease_until":               0,
			"lease_owner":               "",
			"last_error":                state.DisableReason,
			"last_cancel_reason":        "",
			"soft_budget_notified_date": "",
			"updated_at":                now,
		}),
	}).Create(state).Error
}

func EnsureChannelRecoveryState(state *ChannelRecoveryState) error {
	if state == nil {
		return errors.New("channel recovery state is nil")
	}
	return DB.Clauses(clause.OnConflict{DoNothing: true}).Create(state).Error
}

func DeleteChannelRecoveryStates(channelId int) error {
	return DB.Where("channel_id = ?", channelId).Delete(&ChannelRecoveryState{}).Error
}

func DeleteChannelRecoveryState(channelId int, keyIndex int) error {
	return DB.Where("channel_id = ? AND key_index = ?", channelId, keyIndex).Delete(&ChannelRecoveryState{}).Error
}

func GetChannelRecoveryState(channelId int, keyIndex int) (*ChannelRecoveryState, error) {
	var state ChannelRecoveryState
	err := DB.Where("channel_id = ? AND key_index = ?", channelId, keyIndex).First(&state).Error
	return &state, err
}

func ListDueChannelRecoveryStates(now int64, limit int) ([]*ChannelRecoveryState, error) {
	if limit < 1 {
		limit = 1
	}
	var states []*ChannelRecoveryState
	err := DB.Where("state IN ? AND next_probe_at > 0 AND next_probe_at <= ? AND (lease_until = 0 OR lease_until < ?)",
		[]string{
			ChannelRecoveryStateAutoDisabled,
			ChannelRecoveryStateFastProbing,
			ChannelRecoveryStateWatching,
			ChannelRecoveryStateProbation,
		}, now, now).
		Order("next_probe_at asc").
		Limit(limit).
		Find(&states).Error
	return states, err
}

func AcquireChannelRecoveryLease(channelId int, keyIndex int, owner string, now int64, leaseUntil int64) (bool, error) {
	result := DB.Model(&ChannelRecoveryState{}).
		Where("channel_id = ? AND key_index = ? AND next_probe_at > 0 AND next_probe_at <= ? AND (lease_until = 0 OR lease_until < ?)", channelId, keyIndex, now, now).
		Updates(map[string]interface{}{
			"lease_until": leaseUntil,
			"lease_owner": owner,
			"updated_at":  now,
		})
	return result.RowsAffected == 1, result.Error
}

func ReleaseChannelRecoveryLease(channelId int, keyIndex int, owner string) error {
	return DB.Model(&ChannelRecoveryState{}).
		Where("channel_id = ? AND key_index = ? AND lease_owner = ?", channelId, keyIndex, owner).
		Updates(map[string]interface{}{
			"lease_until": 0,
			"lease_owner": "",
		}).Error
}

func UpdateChannelRecoveryProbe(channelId int, keyIndex int, owner string, update ChannelRecoveryProbeUpdate) (*ChannelRecoveryState, error) {
	var updated ChannelRecoveryState
	err := DB.Transaction(func(tx *gorm.DB) error {
		query := lockForUpdate(tx).Where("channel_id = ? AND key_index = ?", channelId, keyIndex)
		if err := query.First(&updated).Error; err != nil {
			return err
		}
		if updated.LeaseOwner != owner {
			return fmt.Errorf("channel recovery lease owner changed")
		}

		probeDate := time.Unix(update.LastProbeAt, 0).Format("2006-01-02")
		dailyCount := updated.DailyProbeCount
		if updated.ProbeCountDate != probeDate {
			dailyCount = 0
		}
		dailyCount++

		values := map[string]interface{}{
			"state":                     update.State,
			"failure_streak":            update.FailureStreak,
			"success_streak":            update.SuccessStreak,
			"next_probe_at":             update.NextProbeAt,
			"last_probe_at":             update.LastProbeAt,
			"last_latency_ms":           update.LastLatencyMs,
			"daily_probe_count":         dailyCount,
			"probe_count_date":          probeDate,
			"lease_until":               0,
			"lease_owner":               "",
			"last_error":                update.LastError,
			"last_cancel_reason":        update.LastCancelReason,
			"soft_budget_notified_date": update.SoftBudgetNotifiedDate,
			"updated_at":                update.LastProbeAt,
		}
		if update.DisabledAt > 0 {
			values["disabled_at"] = update.DisabledAt
		}
		if err := tx.Model(&ChannelRecoveryState{}).
			Where("id = ? AND lease_owner = ?", updated.Id, owner).
			Updates(values).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", updated.Id).First(&updated).Error
	})
	return &updated, err
}

func CountChannelRecoveryStates() (map[string]int64, error) {
	type stateCount struct {
		State string
		Count int64
	}
	var counts []stateCount
	if err := DB.Model(&ChannelRecoveryState{}).Select("state, COUNT(*) AS count").Group("state").Scan(&counts).Error; err != nil {
		return nil, err
	}
	result := make(map[string]int64, len(counts))
	for _, count := range counts {
		result[count.State] = count.Count
	}
	return result, nil
}

func MarkChannelRecoveryEnabled(channelId int, keyIndex int, now int64) error {
	return DB.Model(&ChannelRecoveryState{}).
		Where("channel_id = ? AND key_index = ?", channelId, keyIndex).
		Updates(map[string]interface{}{
			"state":         ChannelRecoveryStateEnabled,
			"next_probe_at": 0,
			"lease_until":   0,
			"lease_owner":   "",
			"last_error":    "",
			"updated_at":    now,
		}).Error
}

func ResetChannelRecoveryState(channelId int, keyIndex int, reasonCode string, now int64) (bool, error) {
	result := DB.Model(&ChannelRecoveryState{}).
		Where("channel_id = ? AND key_index = ? AND (lease_until = 0 OR lease_until < ?)", channelId, keyIndex, now).
		Updates(map[string]interface{}{
			"state":               ChannelRecoveryStateAutoDisabled,
			"disable_reason_code": reasonCode,
			"failure_streak":      0,
			"success_streak":      0,
			"disabled_at":         now,
			"next_probe_at":       now,
			"lease_until":         0,
			"lease_owner":         "",
			"last_error":          "",
			"updated_at":          now,
		})
	return result.RowsAffected == 1, result.Error
}

// ScheduleChannelRecoveryProbeNow makes a target eligible for one immediate
// recovery round without resetting its cross-round streak. An active lease is
// deliberately left untouched so a manual action cannot create a concurrent
// probe or invalidate the worker currently owning the target.
func ScheduleChannelRecoveryProbeNow(channelId int, keyIndex int, now int64) (bool, error) {
	result := DB.Model(&ChannelRecoveryState{}).
		Where("channel_id = ? AND key_index = ? AND (lease_until = 0 OR lease_until < ?)", channelId, keyIndex, now).
		Updates(map[string]interface{}{
			"state":         ChannelRecoveryStateAutoDisabled,
			"next_probe_at": now,
			"updated_at":    now,
		})
	return result.RowsAffected == 1, result.Error
}

func ListChannelRecoveryStates(page int, pageSize int, state string, channelId int) ([]*ChannelRecoveryListItem, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 20
	}
	query := DB.Table("channel_recovery_states AS recovery").
		Joins("JOIN channels AS channel ON channel.id = recovery.channel_id")
	if state != "" {
		query = query.Where("recovery.state = ?", state)
	}
	if channelId > 0 {
		query = query.Where("recovery.channel_id = ?", channelId)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []*ChannelRecoveryListItem
	err := query.Select("recovery.*, channel.name AS channel_name, channel.type AS channel_type, channel.status AS channel_status, COALESCE(channel.priority, 0) AS channel_priority").
		Order("CASE WHEN recovery.next_probe_at = 0 THEN 1 ELSE 0 END, recovery.next_probe_at asc, recovery.channel_id asc, recovery.key_index asc").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Scan(&items).Error
	return items, total, err
}

func AcquireChannelRecoveryWorkerSlot(slot int, owner string, now int64, leaseUntil int64) (bool, error) {
	seed := &ChannelRecoveryWorkerLease{Slot: slot}
	if err := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(seed).Error; err != nil {
		return false, err
	}
	result := DB.Model(&ChannelRecoveryWorkerLease{}).
		Where("slot = ? AND (lease_until = 0 OR lease_until < ? OR lease_owner = ?)", slot, now, owner).
		Updates(map[string]interface{}{
			"lease_until": leaseUntil,
			"lease_owner": owner,
			"updated_at":  now,
		})
	return result.RowsAffected == 1, result.Error
}

func ReleaseChannelRecoveryWorkerSlot(slot int, owner string) error {
	return DB.Model(&ChannelRecoveryWorkerLease{}).
		Where("slot = ? AND lease_owner = ?", slot, owner).
		Updates(map[string]interface{}{
			"lease_until": 0,
			"lease_owner": "",
		}).Error
}

func IsChannelRecoveryNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}

func LogChannelRecoveryModelError(action string, err error) {
	if err != nil {
		common.SysError(fmt.Sprintf("channel recovery %s failed: %v", action, err))
	}
}
