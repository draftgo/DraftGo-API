package helper

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestRewriteOpenAIResponseModelForClient(t *testing.T) {
	info := &relaycommon.RelayInfo{
		OriginModelName: "A-1",
		ChannelMeta: &relaycommon.ChannelMeta{
			IsModelMapped:     true,
			UpstreamModelName: "A-2",
		},
	}
	body := []byte(`{"id":"chatcmpl","model":"A-2","nested":{"model":"A-2"}}`)

	rewritten := RewriteOpenAIResponseModelForClient(info, body)

	require.JSONEq(t, `{"id":"chatcmpl","model":"A-1","nested":{"model":"A-1"}}`, string(rewritten))
}

func TestRewriteChatCompletionStreamModelForClient(t *testing.T) {
	info := &relaycommon.RelayInfo{
		OriginModelName: "A-1",
		ChannelMeta: &relaycommon.ChannelMeta{
			IsModelMapped:     true,
			UpstreamModelName: "A-2",
		},
	}
	resp := &dto.ChatCompletionsStreamResponse{Model: "A-2"}

	RewriteChatCompletionStreamModelForClient(info, resp)

	require.Equal(t, "A-1", resp.Model)
}

func TestRewriteOpenAIErrorModelForClient(t *testing.T) {
	info := &relaycommon.RelayInfo{
		OriginModelName: "A-1",
		ChannelMeta: &relaycommon.ChannelMeta{
			IsModelMapped:     true,
			UpstreamModelName: "A-2",
		},
	}

	msg := RewriteOpenAIErrorModelForClient(info, `model "A-2" is unavailable`)

	require.Equal(t, `model "A-1" is unavailable`, msg)
}
