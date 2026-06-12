package controller

import (
	"errors"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSettleTestQuotaUsesTieredBilling(t *testing.T) {
	info := &relaycommon.RelayInfo{
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode:   "tiered_expr",
			ExprString:    `param("stream") == true ? tier("stream", p * 3) : tier("base", p * 2)`,
			ExprHash:      billingexpr.ExprHashString(`param("stream") == true ? tier("stream", p * 3) : tier("base", p * 2)`),
			GroupRatio:    1,
			EstimatedTier: "stream",
			QuotaPerUnit:  common.QuotaPerUnit,
			ExprVersion:   1,
		},
		BillingRequestInput: &billingexpr.RequestInput{
			Body: []byte(`{"stream":true}`),
		},
	}

	quota, result := settleTestQuota(info, types.PriceData{
		ModelRatio:      1,
		CompletionRatio: 2,
	}, &dto.Usage{
		PromptTokens: 1000,
	})

	require.Equal(t, 1500, quota)
	require.NotNil(t, result)
	require.Equal(t, "stream", result.MatchedTier)
}

func TestBuildTestLogOtherInjectsTieredInfo(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	info := &relaycommon.RelayInfo{
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode: "tiered_expr",
			ExprString:  `tier("base", p * 2)`,
		},
		ChannelMeta: &relaycommon.ChannelMeta{},
	}
	priceData := types.PriceData{
		GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1},
	}
	usage := &dto.Usage{
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 12,
		},
	}

	other := buildTestLogOther(ctx, info, priceData, usage, &billingexpr.TieredResult{
		MatchedTier: "base",
	})

	require.Equal(t, "tiered_expr", other["billing_mode"])
	require.Equal(t, "base", other["matched_tier"])
	require.NotEmpty(t, other["expr_b64"])
}

func TestResolveChannelTestUserIDUsesRequestUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("id", 2)

	userID, err := resolveChannelTestUserID(ctx)

	require.NoError(t, err)
	require.Equal(t, 2, userID)
}

func TestChannelTestEndpointSupportsStream(t *testing.T) {
	tests := []struct {
		name         string
		endpointType string
		requestPath  string
		want         bool
	}{
		{
			name:         "openai chat endpoint",
			endpointType: string(constant.EndpointTypeOpenAI),
			want:         true,
		},
		{
			name:         "responses endpoint",
			endpointType: string(constant.EndpointTypeOpenAIResponse),
			want:         true,
		},
		{
			name:         "anthropic endpoint",
			endpointType: string(constant.EndpointTypeAnthropic),
			want:         true,
		},
		{
			name:         "gemini endpoint",
			endpointType: string(constant.EndpointTypeGemini),
			want:         true,
		},
		{
			name:         "image endpoint",
			endpointType: string(constant.EndpointTypeImageGeneration),
			want:         false,
		},
		{
			name:         "embedding endpoint",
			endpointType: string(constant.EndpointTypeEmbeddings),
			want:         false,
		},
		{
			name:         "rerank endpoint",
			endpointType: string(constant.EndpointTypeJinaRerank),
			want:         false,
		},
		{
			name:         "responses compact endpoint",
			endpointType: string(constant.EndpointTypeOpenAIResponseCompact),
			want:         false,
		},
		{
			name:        "auto-detected chat path",
			requestPath: "/v1/chat/completions",
			want:        true,
		},
		{
			name:        "auto-detected image path",
			requestPath: "/v1/images/generations",
			want:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, channelTestEndpointSupportsStream(tt.endpointType, tt.requestPath))
		})
	}
}

func TestRecoveryProbeCountDefaultsToOne(t *testing.T) {
	setting := operation_setting.GetMonitorSetting()
	originalCount := setting.RecoveryProbeCount
	t.Cleanup(func() {
		setting.RecoveryProbeCount = originalCount
	})

	setting.RecoveryProbeCount = 0
	require.Equal(t, 1, recoveryProbeCount())

	setting.RecoveryProbeCount = 3
	require.Equal(t, 3, recoveryProbeCount())
}

func TestRecoveryProbeIntervalDefaultsToFiveMinutes(t *testing.T) {
	setting := operation_setting.GetMonitorSetting()
	originalInterval := setting.RecoveryProbeMinutes
	t.Cleanup(func() {
		setting.RecoveryProbeMinutes = originalInterval
	})

	setting.RecoveryProbeMinutes = 0
	require.Equal(t, 5*time.Minute, recoveryProbeInterval(setting))

	setting.RecoveryProbeMinutes = 0.5
	require.Equal(t, 30*time.Second, recoveryProbeInterval(setting))

	setting.RecoveryProbeMinutes = 2
	require.Equal(t, 2*time.Minute, recoveryProbeInterval(setting))
}

func TestProbeRecoveryChannelsRunsChannelsConcurrently(t *testing.T) {
	channels := []*model.Channel{
		{Id: 1},
		{Id: 2},
		{Id: 3},
	}
	started := make(chan int, len(channels))
	release := make(chan struct{})

	var mu sync.Mutex
	completed := make([]int, 0, len(channels))
	done := make(chan struct{})
	go func() {
		probeRecoveryChannels(channels, 1, func(channel *model.Channel, probeUserID int) {
			started <- channel.Id
			<-release
			mu.Lock()
			completed = append(completed, channel.Id)
			mu.Unlock()
		})
		close(done)
	}()

	for range channels {
		select {
		case <-started:
		case <-time.After(time.Second):
			t.Fatal("expected every channel probe to start before any probe completes")
		}
	}

	close(release)
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("expected channel probes to complete")
	}

	mu.Lock()
	defer mu.Unlock()
	require.Len(t, completed, len(channels))
}

func TestAllRecoveryProbeAttemptsPassedRequiresEveryAttempt(t *testing.T) {
	setting := operation_setting.GetMonitorSetting()
	originalThreshold := setting.RecoveryThresholdSeconds
	originalEnable := common.AutomaticEnableChannelEnabled
	t.Cleanup(func() {
		setting.RecoveryThresholdSeconds = originalThreshold
		common.AutomaticEnableChannelEnabled = originalEnable
	})

	common.AutomaticEnableChannelEnabled = true
	setting.RecoveryThresholdSeconds = 10

	require.True(t, allRecoveryProbeAttemptsPassed([]recoveryProbeAttempt{
		{milliseconds: 9000},
		{milliseconds: 10000},
	}, common.ChannelStatusAutoDisabled))

	require.False(t, allRecoveryProbeAttemptsPassed([]recoveryProbeAttempt{
		{milliseconds: 9000},
		{milliseconds: 10001},
	}, common.ChannelStatusAutoDisabled))

	require.False(t, allRecoveryProbeAttemptsPassed([]recoveryProbeAttempt{
		{milliseconds: 9000},
		{
			result: testResult{
				newAPIError: types.NewError(errors.New("probe failed"), types.ErrorCodeDoRequestFailed),
			},
			milliseconds: 1000,
		},
	}, common.ChannelStatusAutoDisabled))
}

func TestFirstPassedRecoveryProbeAttemptUsesAnySuccessfulAttempt(t *testing.T) {
	setting := operation_setting.GetMonitorSetting()
	originalThreshold := setting.RecoveryThresholdSeconds
	originalEnable := common.AutomaticEnableChannelEnabled
	t.Cleanup(func() {
		setting.RecoveryThresholdSeconds = originalThreshold
		common.AutomaticEnableChannelEnabled = originalEnable
	})

	common.AutomaticEnableChannelEnabled = true
	setting.RecoveryThresholdSeconds = 10

	attempts := []recoveryProbeAttempt{
		{
			result: testResult{
				newAPIError: types.NewError(errors.New("probe failed"), types.ErrorCodeDoRequestFailed),
			},
			milliseconds: 1000,
		},
		{milliseconds: 9000},
	}

	passed := firstPassedRecoveryProbeAttempt(attempts, common.ChannelStatusAutoDisabled)
	require.NotNil(t, passed)
	require.Equal(t, int64(9000), passed.milliseconds)
}

func TestFindMultiKeyIndexByKey(t *testing.T) {
	channel := &model.Channel{
		ChannelInfo: model.ChannelInfo{
			IsMultiKey: true,
		},
		Key: "key-a\nkey-b\nkey-c",
	}

	keyIndex := findMultiKeyIndexByKey(channel, "key-b")
	require.NotNil(t, keyIndex)
	require.Equal(t, 1, *keyIndex)

	require.Nil(t, findMultiKeyIndexByKey(channel, "missing-key"))
	require.Nil(t, findMultiKeyIndexByKey(&model.Channel{Key: "key-a"}, "key-a"))
}
