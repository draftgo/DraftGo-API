package service

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestShouldDisableChannelUsesOriginalErrorForKeywordMatching(t *testing.T) {
	oldAutomaticDisableChannelEnabled := common.AutomaticDisableChannelEnabled
	oldKeywords := operation_setting.AutomaticDisableKeywords
	t.Cleanup(func() {
		common.AutomaticDisableChannelEnabled = oldAutomaticDisableChannelEnabled
		operation_setting.AutomaticDisableKeywords = oldKeywords
	})

	common.AutomaticDisableChannelEnabled = true
	operation_setting.AutomaticDisableKeywords = []string{"provider secret shard alpha"}

	err := types.NewOpenAIError(
		errors.New("provider secret shard alpha returned custom failure for url: https://upstream.example.com/v1/chat/completions"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadGateway,
	)

	require.Equal(t, common.DefaultUpstreamErrorMessage, err.ToOpenAIError().Message)
	require.True(t, ShouldDisableChannel(err))
}
