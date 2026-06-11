package openai

import (
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/types"
)

func newEmptyResponseError() *types.NewAPIError {
	return types.NewOpenAIError(
		errors.New("upstream returned an empty response"),
		types.ErrorCodeEmptyResponse,
		http.StatusBadGateway,
	)
}

func usageHasTokens(usage *dto.Usage) bool {
	if usage == nil {
		return false
	}
	return usage.PromptTokens != 0 ||
		usage.CompletionTokens != 0 ||
		usage.TotalTokens != 0 ||
		usage.InputTokens != 0 ||
		usage.OutputTokens != 0 ||
		usage.PromptTokensDetails.CachedTokens != 0 ||
		usage.PromptTokensDetails.CachedCreationTokens != 0 ||
		usage.PromptTokensDetails.TextTokens != 0 ||
		usage.PromptTokensDetails.AudioTokens != 0 ||
		usage.PromptTokensDetails.ImageTokens != 0 ||
		usage.CompletionTokenDetails.TextTokens != 0 ||
		usage.CompletionTokenDetails.AudioTokens != 0 ||
		usage.CompletionTokenDetails.ImageTokens != 0 ||
		usage.CompletionTokenDetails.ReasoningTokens != 0 ||
		usage.ClaudeCacheCreation5mTokens != 0 ||
		usage.ClaudeCacheCreation1hTokens != 0
}

func rawToolCallsHasOutput(raw []byte) bool {
	if len(raw) == 0 {
		return false
	}
	rawStr := string(raw)
	return rawStr != "null" && rawStr != "[]"
}

func openAITextResponseHasOutput(resp *dto.OpenAITextResponse) bool {
	if resp == nil {
		return false
	}
	for _, choice := range resp.Choices {
		if choice.Message.StringContent() != "" || choice.Message.GetReasoningContent() != "" {
			return true
		}
		if rawToolCallsHasOutput(choice.Message.ToolCalls) {
			return true
		}
		if choice.FinishReason == constant.FinishReasonContentFilter {
			return true
		}
	}
	return false
}

func chatStreamDataHasOutput(data string) bool {
	if data == "" {
		return false
	}
	var resp dto.ChatCompletionsStreamResponse
	if err := common.UnmarshalJsonStr(data, &resp); err != nil {
		return true
	}
	if usageHasTokens(resp.Usage) {
		return true
	}
	for _, choice := range resp.Choices {
		if choice.Delta.GetContentString() != "" || choice.Delta.GetReasoningContent() != "" {
			return true
		}
		if len(choice.Delta.ToolCalls) > 0 {
			return true
		}
		if choice.FinishReason != nil && *choice.FinishReason == constant.FinishReasonContentFilter {
			return true
		}
	}
	return false
}

func responsesResponseHasOutput(resp *dto.OpenAIResponsesResponse) bool {
	if resp == nil {
		return false
	}
	if resp.HasImageGenerationCall() {
		return true
	}
	for _, output := range resp.Output {
		switch output.Type {
		case "":
			continue
		case "message":
			for _, content := range output.Content {
				if content.Text != "" {
					return true
				}
			}
		case "function_call":
			if output.Name != "" || output.CallId != "" || output.ID != "" || len(output.Arguments) > 0 {
				return true
			}
		default:
			return true
		}
	}
	return false
}
