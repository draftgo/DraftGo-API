package helper

import (
	"encoding/json"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func RewriteOpenAIResponseModelForClient(info *relaycommon.RelayInfo, body []byte) []byte {
	if !HasInternalModelMapping(info) || len(body) == 0 {
		return body
	}
	clientModel := ClientVisibleModelName(info, "")
	if clientModel == "" {
		return body
	}
	var payload any
	if err := common.Unmarshal(body, &payload); err != nil {
		return body
	}
	changed := rewriteModelFields(payload, clientModel)
	if !changed {
		return body
	}
	rewritten, err := common.Marshal(payload)
	if err != nil {
		return body
	}
	return rewritten
}

func rewriteModelFields(value any, clientModel string) bool {
	switch v := value.(type) {
	case map[string]any:
		changed := false
		if _, ok := v["model"]; ok {
			v["model"] = clientModel
			changed = true
		}
		for _, nested := range v {
			if rewriteModelFields(nested, clientModel) {
				changed = true
			}
		}
		return changed
	case []any:
		changed := false
		for _, item := range v {
			if rewriteModelFields(item, clientModel) {
				changed = true
			}
		}
		return changed
	default:
		return false
	}
}

func RewriteChatCompletionStreamModelForClient(info *relaycommon.RelayInfo, resp *dto.ChatCompletionsStreamResponse) {
	if resp == nil || !HasInternalModelMapping(info) {
		return
	}
	resp.Model = ClientVisibleModelName(info, resp.Model)
}

func RewriteChatCompletionStreamDataForClient(info *relaycommon.RelayInfo, data string) string {
	if !HasInternalModelMapping(info) || data == "" {
		return data
	}
	var resp dto.ChatCompletionsStreamResponse
	if err := common.UnmarshalJsonStr(data, &resp); err != nil {
		return data
	}
	RewriteChatCompletionStreamModelForClient(info, &resp)
	rewritten, err := common.Marshal(resp)
	if err != nil {
		return data
	}
	return string(rewritten)
}

func RewriteResponsesModelForClient(info *relaycommon.RelayInfo, resp *dto.OpenAIResponsesResponse) {
	if resp == nil || !HasInternalModelMapping(info) {
		return
	}
	resp.Model = ClientVisibleModelName(info, resp.Model)
}

func RewriteResponsesStreamModelForClient(info *relaycommon.RelayInfo, resp *dto.ResponsesStreamResponse) {
	if resp == nil || resp.Response == nil {
		return
	}
	RewriteResponsesModelForClient(info, resp.Response)
}

func RewriteResponsesStreamDataForClient(info *relaycommon.RelayInfo, data string) string {
	if !HasInternalModelMapping(info) || data == "" {
		return data
	}
	var resp dto.ResponsesStreamResponse
	if err := common.UnmarshalJsonStr(data, &resp); err != nil {
		return data
	}
	RewriteResponsesStreamModelForClient(info, &resp)
	rewritten, err := common.Marshal(resp)
	if err != nil {
		return data
	}
	return string(rewritten)
}

func RewriteOpenAIErrorModelForClient(info *relaycommon.RelayInfo, message string) string {
	if !HasInternalModelMapping(info) || message == "" {
		return message
	}
	upstreamModel := info.UpstreamModelName
	clientModel := ClientVisibleModelName(info, upstreamModel)
	if upstreamModel == "" || clientModel == "" || upstreamModel == clientModel {
		return message
	}
	b, _ := json.Marshal(clientModel)
	quotedClientModel := string(b)
	b, _ = json.Marshal(upstreamModel)
	quotedUpstreamModel := string(b)
	message = common.ReplaceAllCaseInsensitive(message, quotedUpstreamModel, quotedClientModel)
	return common.ReplaceAllCaseInsensitive(message, upstreamModel, clientModel)
}
