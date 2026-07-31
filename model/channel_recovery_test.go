package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelRecoveryTargetLeaseAllowsOnlyOneOwner(t *testing.T) {
	truncateTables(t)
	require.NoError(t, UpsertChannelRecoveryState(&ChannelRecoveryState{
		ChannelId:   42,
		KeyIndex:    3,
		State:       ChannelRecoveryStateAutoDisabled,
		DisabledAt:  100,
		NextProbeAt: 120,
	}))

	acquired, err := AcquireChannelRecoveryLease(42, 3, "node-a", 120, 150)
	require.NoError(t, err)
	assert.True(t, acquired)

	acquired, err = AcquireChannelRecoveryLease(42, 3, "node-b", 120, 150)
	require.NoError(t, err)
	assert.False(t, acquired)

	acquired, err = AcquireChannelRecoveryLease(42, 3, "node-b", 151, 180)
	require.NoError(t, err)
	assert.True(t, acquired)
}

func TestChannelRecoveryProbeUpdatePersistsCrossRoundStreakAndDailyCount(t *testing.T) {
	truncateTables(t)
	require.NoError(t, UpsertChannelRecoveryState(&ChannelRecoveryState{
		ChannelId:   9,
		KeyIndex:    -1,
		State:       ChannelRecoveryStateAutoDisabled,
		DisabledAt:  100,
		NextProbeAt: 120,
	}))
	acquired, err := AcquireChannelRecoveryLease(9, -1, "node-a", 120, 150)
	require.NoError(t, err)
	require.True(t, acquired)

	updated, err := UpdateChannelRecoveryProbe(9, -1, "node-a", ChannelRecoveryProbeUpdate{
		State:         ChannelRecoveryStateProbation,
		SuccessStreak: 1,
		NextProbeAt:   180,
		LastProbeAt:   120,
		LastLatencyMs: 45,
	})
	require.NoError(t, err)
	assert.Equal(t, ChannelRecoveryStateProbation, updated.State)
	assert.Equal(t, 1, updated.SuccessStreak)
	assert.Equal(t, 1, updated.DailyProbeCount)
	assert.Equal(t, int64(45), updated.LastLatencyMs)
	assert.Empty(t, updated.LeaseOwner)
}

func TestChannelRecoveryWorkerLeaseCapsEachGlobalSlot(t *testing.T) {
	truncateTables(t)
	acquired, err := AcquireChannelRecoveryWorkerSlot(2, "node-a", 100, 130)
	require.NoError(t, err)
	assert.True(t, acquired)

	acquired, err = AcquireChannelRecoveryWorkerSlot(2, "node-b", 100, 130)
	require.NoError(t, err)
	assert.False(t, acquired)

	require.NoError(t, ReleaseChannelRecoveryWorkerSlot(2, "node-a"))
	acquired, err = AcquireChannelRecoveryWorkerSlot(2, "node-b", 101, 131)
	require.NoError(t, err)
	assert.True(t, acquired)
}

func TestScheduleChannelRecoveryProbeNowPreservesStreak(t *testing.T) {
	truncateTables(t)
	require.NoError(t, UpsertChannelRecoveryState(&ChannelRecoveryState{
		ChannelId:   17,
		KeyIndex:    2,
		State:       ChannelRecoveryStateWatching,
		DisabledAt:  100,
		NextProbeAt: 500,
	}))
	require.NoError(t, DB.Model(&ChannelRecoveryState{}).
		Where("channel_id = ? AND key_index = ?", 17, 2).
		Updates(map[string]interface{}{"failure_streak": 4, "success_streak": 1}).Error)

	scheduled, err := ScheduleChannelRecoveryProbeNow(17, 2, 200)
	require.NoError(t, err)
	require.True(t, scheduled)

	state, err := GetChannelRecoveryState(17, 2)
	require.NoError(t, err)
	assert.Equal(t, ChannelRecoveryStateAutoDisabled, state.State)
	assert.Equal(t, int64(200), state.NextProbeAt)
	assert.Equal(t, 4, state.FailureStreak)
	assert.Equal(t, 1, state.SuccessStreak)
}

func TestManualRecoveryActionsCannotReplaceActiveLease(t *testing.T) {
	truncateTables(t)
	require.NoError(t, UpsertChannelRecoveryState(&ChannelRecoveryState{
		ChannelId:   23,
		KeyIndex:    -1,
		State:       ChannelRecoveryStateProbation,
		DisabledAt:  100,
		NextProbeAt: 120,
	}))
	acquired, err := AcquireChannelRecoveryLease(23, -1, "node-a", 120, 180)
	require.NoError(t, err)
	require.True(t, acquired)

	scheduled, err := ScheduleChannelRecoveryProbeNow(23, -1, 130)
	require.NoError(t, err)
	assert.False(t, scheduled)
	reset, err := ResetChannelRecoveryState(23, -1, "manual_reset", 130)
	require.NoError(t, err)
	assert.False(t, reset)

	state, err := GetChannelRecoveryState(23, -1)
	require.NoError(t, err)
	assert.Equal(t, "node-a", state.LeaseOwner)
	assert.Equal(t, int64(180), state.LeaseUntil)
}
