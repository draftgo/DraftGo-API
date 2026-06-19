package model

import (
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// PerfMetric stores aggregated relay performance metrics for the model square.
type PerfMetric struct {
	Id             int    `json:"id" gorm:"primaryKey"`
	ModelName      string `json:"model_name" gorm:"size:128;uniqueIndex:idx_perf_model_group_bucket,priority:1"`
	Group          string `json:"group" gorm:"column:group;size:64;uniqueIndex:idx_perf_model_group_bucket,priority:2"`
	BucketTs       int64  `json:"bucket_ts" gorm:"uniqueIndex:idx_perf_model_group_bucket,priority:3;index:idx_perf_bucket_ts"`
	RequestCount   int64  `json:"-" gorm:"default:0"`
	SuccessCount   int64  `json:"-" gorm:"default:0"`
	TotalLatencyMs int64  `json:"-" gorm:"default:0"`
	TtftSumMs      int64  `json:"-" gorm:"default:0"`
	TtftCount      int64  `json:"-" gorm:"default:0"`
	OutputTokens   int64  `json:"-" gorm:"default:0"`
	GenerationMs   int64  `json:"-" gorm:"default:0"`
}

func (PerfMetric) TableName() string {
	return "perf_metrics"
}

func UpsertPerfMetric(metric *PerfMetric) error {
	if metric == nil || metric.RequestCount == 0 {
		return nil
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "model_name"},
			{Name: "group"},
			{Name: "bucket_ts"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"request_count":    gorm.Expr("perf_metrics.request_count + ?", metric.RequestCount),
			"success_count":    gorm.Expr("perf_metrics.success_count + ?", metric.SuccessCount),
			"total_latency_ms": gorm.Expr("perf_metrics.total_latency_ms + ?", metric.TotalLatencyMs),
			"ttft_sum_ms":      gorm.Expr("perf_metrics.ttft_sum_ms + ?", metric.TtftSumMs),
			"ttft_count":       gorm.Expr("perf_metrics.ttft_count + ?", metric.TtftCount),
			"output_tokens":    gorm.Expr("perf_metrics.output_tokens + ?", metric.OutputTokens),
			"generation_ms":    gorm.Expr("perf_metrics.generation_ms + ?", metric.GenerationMs),
		}),
	}).Create(metric).Error
}

func GetPerfMetrics(modelName string, group string, startTs int64, endTs int64) ([]PerfMetric, error) {
	var metrics []PerfMetric
	query := DB.Model(&PerfMetric{}).
		Where("model_name = ? AND bucket_ts >= ? AND bucket_ts <= ?", modelName, startTs, endTs)
	if group != "" {
		query = query.Where(commonGroupCol+" = ?", group)
	}
	err := query.Order("bucket_ts ASC").Find(&metrics).Error
	return metrics, err
}

type PerfMetricSummary struct {
	ModelName      string `json:"model_name"`
	RequestCount   int64  `json:"request_count"`
	SuccessCount   int64  `json:"success_count"`
	TotalLatencyMs int64  `json:"total_latency_ms"`
	OutputTokens   int64  `json:"output_tokens"`
	GenerationMs   int64  `json:"generation_ms"`
}

type ModelAvailabilitySummary struct {
	ModelName           string
	TotalChannels       int
	AvailableChannels   int
	TestedChannels      int
	FreshTestedChannels int
	LastTestTime        int64
	AvgTestLatencyMs    int64
}

type modelAvailabilityRow struct {
	ModelName    string
	ChannelId    int
	AbilityOn    bool
	Status       int
	TestTime     int64
	ResponseTime int
}

func GetModelAvailabilitySummaries(freshCutoff int64) (map[string]ModelAvailabilitySummary, error) {
	var rows []modelAvailabilityRow
	err := DB.Table("abilities").
		Select("abilities.model as model_name, abilities.channel_id, abilities.enabled as ability_on, channels.status, channels.test_time, channels.response_time").
		Joins("left join channels on abilities.channel_id = channels.id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	type channelState struct {
		available    bool
		testTime     int64
		responseTime int
	}
	byModel := make(map[string]map[int]channelState)
	for _, row := range rows {
		if row.ModelName == "" || row.ChannelId == 0 {
			continue
		}
		if _, ok := byModel[row.ModelName]; !ok {
			byModel[row.ModelName] = make(map[int]channelState)
		}
		state := byModel[row.ModelName][row.ChannelId]
		if row.AbilityOn && row.Status == common.ChannelStatusEnabled {
			state.available = true
		}
		if row.TestTime > state.testTime {
			state.testTime = row.TestTime
			state.responseTime = row.ResponseTime
		}
		byModel[row.ModelName][row.ChannelId] = state
	}

	result := make(map[string]ModelAvailabilitySummary, len(byModel))
	for modelName, channels := range byModel {
		summary := ModelAvailabilitySummary{ModelName: modelName}
		var latencySum int64
		for _, state := range channels {
			summary.TotalChannels++
			if state.available {
				summary.AvailableChannels++
			}
			if state.testTime > 0 {
				summary.TestedChannels++
				if freshCutoff > 0 && state.testTime >= freshCutoff {
					summary.FreshTestedChannels++
				}
				if state.testTime > summary.LastTestTime {
					summary.LastTestTime = state.testTime
				}
				if state.responseTime > 0 {
					latencySum += int64(state.responseTime)
				}
			}
		}
		if summary.TestedChannels > 0 && latencySum > 0 {
			summary.AvgTestLatencyMs = latencySum / int64(summary.TestedChannels)
		}
		result[modelName] = summary
	}
	return result, nil
}

type PerfMetricSummaryBucket struct {
	ModelName      string `json:"model_name"`
	BucketTs       int64  `json:"bucket_ts"`
	RequestCount   int64  `json:"request_count"`
	SuccessCount   int64  `json:"success_count"`
	TotalLatencyMs int64  `json:"total_latency_ms"`
	OutputTokens   int64  `json:"output_tokens"`
	GenerationMs   int64  `json:"generation_ms"`
}

func GetPerfMetricsSummaryAll(startTs int64, endTs int64, groups []string) ([]PerfMetricSummary, error) {
	var summaries []PerfMetricSummary
	query := DB.Model(&PerfMetric{}).
		Select("model_name, SUM(request_count) as request_count, SUM(success_count) as success_count, SUM(total_latency_ms) as total_latency_ms, SUM(output_tokens) as output_tokens, SUM(generation_ms) as generation_ms").
		Where("bucket_ts >= ? AND bucket_ts <= ?", startTs, endTs)
	if groups != nil {
		if len(groups) == 0 {
			return summaries, nil
		}
		query = query.Where(commonGroupCol+" IN ?", groups)
	}
	err := query.
		Group("model_name").
		Having("SUM(request_count) > 0").
		Find(&summaries).Error
	return summaries, err
}

func GetPerfMetricsSummaryBucketsAll(startTs int64, endTs int64, groups []string) ([]PerfMetricSummaryBucket, error) {
	var summaries []PerfMetricSummaryBucket
	query := DB.Model(&PerfMetric{}).
		Select("model_name, bucket_ts, SUM(request_count) as request_count, SUM(success_count) as success_count, SUM(total_latency_ms) as total_latency_ms, SUM(output_tokens) as output_tokens, SUM(generation_ms) as generation_ms").
		Where("bucket_ts >= ? AND bucket_ts <= ?", startTs, endTs)
	if groups != nil {
		if len(groups) == 0 {
			return summaries, nil
		}
		query = query.Where(commonGroupCol+" IN ?", groups)
	}
	err := query.
		Group("model_name, bucket_ts").
		Having("SUM(request_count) > 0").
		Order("bucket_ts ASC").
		Find(&summaries).Error
	return summaries, err
}

func DeletePerfMetricsBefore(cutoffTs int64) error {
	if cutoffTs <= 0 {
		return nil
	}
	return DB.Where("bucket_ts < ?", cutoffTs).Delete(&PerfMetric{}).Error
}

func PerfMetricStartTime(hours int) int64 {
	if hours <= 0 {
		hours = 24
	}
	return time.Now().Add(-time.Duration(hours) * time.Hour).Unix()
}
