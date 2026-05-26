package service

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

type failureRecord struct {
	mu        sync.Mutex
	count     int
	firstFail time.Time
}

var failureTracker sync.Map

func getTrackerKey(channelId int, key string) string {
	return fmt.Sprintf("%d:%s", channelId, key)
}

// RecordFailure records a failure and returns true if the channel should be disabled.
func RecordFailure(channelId int, key string) bool {
	window := time.Duration(common.ChannelDisableWindowMinutes) * time.Minute
	threshold := common.ChannelDisableFailureThreshold

	if threshold <= 1 {
		return true
	}

	mapKey := getTrackerKey(channelId, key)
	now := time.Now()

	val, _ := failureTracker.LoadOrStore(mapKey, &failureRecord{count: 0, firstFail: now})
	record := val.(*failureRecord)

	record.mu.Lock()
	defer record.mu.Unlock()

	if record.count > 0 && now.Sub(record.firstFail) > window {
		record.count = 0
		record.firstFail = now
	}

	if record.count == 0 {
		record.firstFail = now
	}
	record.count++

	return record.count >= threshold
}

// ClearFailure clears the failure record for a channel (called on recovery).
func ClearFailure(channelId int, key string) {
	failureTracker.Delete(getTrackerKey(channelId, key))
}
