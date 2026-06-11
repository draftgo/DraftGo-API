package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func newEmptyResponseTestContext(path string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, path, nil)
	return c, recorder
}

func TestOpenaiHandlerRejectsEmptyChatResponse(t *testing.T) {
	c, _ := newEmptyResponseTestContext("/v1/chat/completions")
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body: io.NopCloser(strings.NewReader(`{
			"id":"chatcmpl-empty",
			"object":"chat.completion",
			"model":"gpt-5.5",
			"choices":[{"index":0,"message":{"role":"assistant","content":""},"finish_reason":"stop"}],
			"usage":{"prompt_tokens":0,"completion_tokens":0,"total_tokens":0}
		}`)),
	}

	usage, apiErr := OpenaiHandler(c, &common.RelayInfo{
		ChannelMeta: &common.ChannelMeta{UpstreamModelName: "gpt-5.5"},
	}, resp)

	if usage != nil {
		t.Fatalf("expected nil usage, got %#v", usage)
	}
	if apiErr == nil {
		t.Fatal("expected empty response error")
	}
	if apiErr.GetErrorCode() != types.ErrorCodeEmptyResponse {
		t.Fatalf("expected error code %q, got %q", types.ErrorCodeEmptyResponse, apiErr.GetErrorCode())
	}
	if apiErr.StatusCode != http.StatusBadGateway {
		t.Fatalf("expected status %d, got %d", http.StatusBadGateway, apiErr.StatusCode)
	}
}

func TestOaiResponsesToChatStreamRejectsEmptyCompletedResponse(t *testing.T) {
	c, recorder := newEmptyResponseTestContext("/v1/chat/completions")
	info := &common.RelayInfo{
		StartTime:          time.Now(),
		RelayFormat:        types.RelayFormatOpenAI,
		ShouldIncludeUsage: true,
		ChannelMeta:        &common.ChannelMeta{UpstreamModelName: "gpt-5.5"},
	}
	c.Set("relay_info", info)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body: io.NopCloser(strings.NewReader(
			`data: {"type":"response.created","response":{"model":"gpt-5.5","created_at":123}}` + "\n\n" +
				`data: {"type":"response.completed","response":{"model":"gpt-5.5","created_at":123,"output":[],"usage":{"input_tokens":0,"output_tokens":0,"total_tokens":0}}}` + "\n\n" +
				"data: [DONE]\n\n",
		)),
	}

	usage, apiErr := OaiResponsesToChatStreamHandler(c, info, resp)

	if usage != nil {
		t.Fatalf("expected nil usage, got %#v", usage)
	}
	if apiErr == nil {
		t.Fatal("expected empty response error")
	}
	if apiErr.GetErrorCode() != types.ErrorCodeEmptyResponse {
		t.Fatalf("expected error code %q, got %q", types.ErrorCodeEmptyResponse, apiErr.GetErrorCode())
	}
	if recorder.Body.Len() != 0 {
		t.Fatalf("expected no response body before retry, got %q", recorder.Body.String())
	}
}
