package operation_setting

import (
	"os"
	"strconv"

	"github.com/QuantumNous/new-api/setting/config"
)

type MonitorSetting struct {
	AutoTestChannelEnabled        bool    `json:"auto_test_channel_enabled"`
	AutoTestChannelMinutes        float64 `json:"auto_test_channel_minutes"`
	ChannelTestMode               string  `json:"channel_test_mode"`
	RecoveryMode                  string  `json:"recovery_mode"`
	RecoveryProbeMinutes          float64 `json:"recovery_probe_minutes"`
	RecoveryProbeCount            int     `json:"recovery_probe_count"`
	RecoveryThresholdSeconds      float64 `json:"recovery_threshold_seconds"`
	RecoveryHighPriorityMinutes   float64 `json:"recovery_high_priority_minutes"`
	RecoveryHighPriorityThreshold int64   `json:"recovery_high_priority_threshold"`
	RecoveryProbationSeconds      int     `json:"recovery_probation_seconds"`
	RecoveryWorkerCount           int     `json:"recovery_worker_count"`
	RecoveryMaxOutputTokens       int     `json:"recovery_max_output_tokens"`
	RecoveryDailyProbeBudget      int     `json:"recovery_daily_probe_budget"`
}

const (
	ChannelTestModeScheduledAll    = "scheduled_all"
	ChannelTestModePassiveRecovery = "passive_recovery"
)

// 默认配置
var monitorSetting = MonitorSetting{
	AutoTestChannelEnabled:        false,
	AutoTestChannelMinutes:        10,
	ChannelTestMode:               ChannelTestModeScheduledAll,
	RecoveryMode:                  "follow",
	RecoveryProbeMinutes:          5,
	RecoveryProbeCount:            1,
	RecoveryThresholdSeconds:      15,
	RecoveryHighPriorityMinutes:   2,
	RecoveryHighPriorityThreshold: 10,
	RecoveryProbationSeconds:      60,
	RecoveryWorkerCount:           4,
	RecoveryMaxOutputTokens:       16,
	RecoveryDailyProbeBudget:      200,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("monitor_setting", &monitorSetting)
}

func GetMonitorSetting() *MonitorSetting {
	if os.Getenv("CHANNEL_TEST_FREQUENCY") != "" {
		frequency, err := strconv.Atoi(os.Getenv("CHANNEL_TEST_FREQUENCY"))
		if err == nil && frequency > 0 {
			monitorSetting.AutoTestChannelEnabled = true
			monitorSetting.AutoTestChannelMinutes = float64(frequency)
			monitorSetting.ChannelTestMode = ChannelTestModeScheduledAll
		}
	}
	if enabled, ok := os.LookupEnv("CHANNEL_TEST_ENABLED"); ok {
		parsed, err := strconv.ParseBool(enabled)
		if err == nil {
			monitorSetting.AutoTestChannelEnabled = parsed
		}
	}
	if monitorSetting.ChannelTestMode != ChannelTestModePassiveRecovery {
		monitorSetting.ChannelTestMode = ChannelTestModeScheduledAll
	}
	if monitorSetting.RecoveryProbeMinutes <= 0 || monitorSetting.RecoveryProbeMinutes > 5 {
		monitorSetting.RecoveryProbeMinutes = 5
	}
	if monitorSetting.RecoveryHighPriorityMinutes <= 0 || monitorSetting.RecoveryHighPriorityMinutes > 2 {
		monitorSetting.RecoveryHighPriorityMinutes = 2
	}
	if monitorSetting.RecoveryProbationSeconds < 60 || monitorSetting.RecoveryProbationSeconds > 120 {
		monitorSetting.RecoveryProbationSeconds = 60
	}
	if monitorSetting.RecoveryWorkerCount < 2 || monitorSetting.RecoveryWorkerCount > 4 {
		monitorSetting.RecoveryWorkerCount = 4
	}
	if monitorSetting.RecoveryMaxOutputTokens < 1 || monitorSetting.RecoveryMaxOutputTokens > 16 {
		monitorSetting.RecoveryMaxOutputTokens = 16
	}
	if monitorSetting.RecoveryDailyProbeBudget < 1 {
		monitorSetting.RecoveryDailyProbeBudget = 200
	}
	return &monitorSetting
}
