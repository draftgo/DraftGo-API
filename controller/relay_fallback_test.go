package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRelayModelCandidatesUseExplicitTokenOrder(t *testing.T) {
	c, _ := gin.CreateTestContext(nil)
	common.SetContextKey(c, constant.ContextKeyTokenFallbackModelEnabled, true)
	common.SetContextKey(c, constant.ContextKeyTokenFallbackModels, []string{" model-a ", "model-a", "model-b"})
	info := &relaycommon.RelayInfo{OriginModelName: "requested", TokenGroup: "default"}

	assert.Equal(t, []string{"requested", "model-a", "model-b"}, relayModelCandidates(c, info, types.RelayFormatOpenAI))
}

func TestRelayModelCandidatesRespectTokenModelLimits(t *testing.T) {
	c, _ := gin.CreateTestContext(nil)
	common.SetContextKey(c, constant.ContextKeyTokenFallbackModelEnabled, true)
	common.SetContextKey(c, constant.ContextKeyTokenFallbackModels, []string{"allowed", "blocked"})
	common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{"allowed": true})
	info := &relaycommon.RelayInfo{OriginModelName: "requested", TokenGroup: "default"}

	assert.Equal(t, []string{"requested", "allowed"}, relayModelCandidates(c, info, types.RelayFormatOpenAI))
}

func TestRelayModelCandidatesStayOnRequestedModelWhenFallbackIsDisabled(t *testing.T) {
	c, _ := gin.CreateTestContext(nil)
	common.SetContextKey(c, constant.ContextKeyTokenFallbackModels, []string{"model-a"})
	info := &relaycommon.RelayInfo{OriginModelName: "requested", TokenGroup: "default"}

	assert.Equal(t, []string{"requested"}, relayModelCandidates(c, info, types.RelayFormatOpenAI))
}

func TestRelayModelCandidatesDoNotFallbackRealtimeOrSpecificChannel(t *testing.T) {
	c, _ := gin.CreateTestContext(nil)
	common.SetContextKey(c, constant.ContextKeyTokenFallbackModelEnabled, true)
	common.SetContextKey(c, constant.ContextKeyTokenFallbackModels, []string{"model-a"})
	info := &relaycommon.RelayInfo{OriginModelName: "requested", TokenGroup: "default"}

	assert.Equal(t, []string{"requested"}, relayModelCandidates(c, info, types.RelayFormatOpenAIRealtime))
	c.Set("specific_channel_id", 12)
	assert.Equal(t, []string{"requested"}, relayModelCandidates(c, info, types.RelayFormatOpenAI))
}

func TestRelayModelCandidatesUseOrderedAutoGroupSystemFallback(t *testing.T) {
	originalFallback := setting.GroupFallbackModels2JSONString()
	originalAuto := setting.AutoGroups2JsonString()
	originalUsable := setting.UserUsableGroups2JSONString()
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateGroupFallbackModelsByJSONString(originalFallback))
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalAuto))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsable))
	})
	require.NoError(t, setting.UpdateGroupFallbackModelsByJSONString(`{"vip":["vip-a","shared"],"default":["default-a","shared"]}`))
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["vip","default"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"auto":"auto","vip":"vip","default":"default"}`))

	c, _ := gin.CreateTestContext(nil)
	common.SetContextKey(c, constant.ContextKeyTokenFallbackModelEnabled, true)
	info := &relaycommon.RelayInfo{OriginModelName: "requested", TokenGroup: "auto", UserGroup: "default"}

	assert.Equal(t, []string{"requested", "vip-a", "shared", "default-a"}, relayModelCandidates(c, info, types.RelayFormatOpenAI))
}

func TestPrepareRelayModelCandidateResetsAttemptState(t *testing.T) {
	c, _ := gin.CreateTestContext(nil)
	info := &relaycommon.RelayInfo{
		OriginModelName:       "requested",
		TokenGroup:            "auto",
		UsingGroup:            "vip",
		ReceivedResponseCount: 3,
		StreamStatus:          relaycommon.NewStreamStatus(),
		ChannelMeta:           &relaycommon.ChannelMeta{UpstreamModelName: "requested", IsModelMapped: true},
	}

	prepareRelayModelCandidate(c, info, "fallback", 2)

	assert.Equal(t, "fallback", info.OriginModelName)
	assert.Equal(t, "fallback", info.UpstreamModelName)
	assert.Equal(t, "auto", info.UsingGroup)
	assert.Zero(t, info.ReceivedResponseCount)
	assert.Nil(t, info.StreamStatus)
	assert.Equal(t, 2, info.BillingAttempt)
}

func TestShouldTryFallbackModelStopsAfterResponseStarts(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{}
	apiErr := types.NewErrorWithStatusCode(errors.New("upstream unavailable"), types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable)

	assert.True(t, shouldTryFallbackModel(c, info, apiErr, false))
	_, err := c.Writer.Write([]byte("started"))
	require.NoError(t, err)
	assert.False(t, shouldTryFallbackModel(c, info, apiErr, false))
}
