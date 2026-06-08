package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRewriteUpstreamError_Enabled(t *testing.T) {
	MaskUpstreamErrors = true

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		// Authentication errors
		{
			name:     "OpenAI invalid API key",
			input:    "Incorrect API key provided: sk-proj-xxx. You can find your API key at https://platform.openai.com/account/api-keys.",
			expected: "服务暂时不可用，请联系管理员",
		},
		{
			name:     "Claude authentication error",
			input:    "authentication_error: invalid x-api-key",
			expected: "服务暂时不可用，请联系管理员",
		},
		// Quota errors
		{
			name:     "OpenAI quota exceeded",
			input:    "You exceeded your current quota, please check your plan and billing details.",
			expected: "服务容量暂时受限，请稍后重试",
		},
		{
			name:     "Claude credit balance",
			input:    "Your credit balance is too low to access the Claude API.",
			expected: "服务容量暂时受限，请稍后重试",
		},
		// Rate limiting
		{
			name:     "Rate limit",
			input:    "Rate limit reached for gpt-4 in organization org-xxx on tokens per min.",
			expected: "请求过于频繁，请稍后重试",
		},
		// Model not found
		{
			name:     "Model does not exist",
			input:    "The model 'gpt-5-turbo' does not exist or you do not have access to it.",
			expected: "所请求的模型当前不可用",
		},
		// Server errors
		{
			name:     "Upstream overloaded",
			input:    "The server is overloaded, please try again later.",
			expected: DefaultUpstreamErrorMessage,
		},
		// Upstream new-api instance errors (Chinese)
		{
			name:     "Upstream new-api channel not found",
			input:    "分组 default 下模型 gpt-4o 的可用渠道不存在（retry）",
			expected: "所请求的模型当前不可用，请稍后重试",
		},
		{
			name:     "Upstream new-api channel fetch failed",
			input:    "获取分组 vip 下模型 claude-3-opus 的可用渠道失败（retry）: some error",
			expected: "所请求的模型当前不可用，请稍后重试",
		},
		{
			name:     "Upstream new-api group overloaded",
			input:    "当前分组负载已饱和，请稍后再试，或升级账户以提升服务质量。",
			expected: "模型请求压力过大，请稍后重试",
		},
		// Context length
		{
			name:     "Context length exceeded",
			input:    "This model's maximum context length is 8192 tokens. However, your messages resulted in 12000 tokens.",
			expected: "请求内容超过该模型的上下文长度限制",
		},
		// No match - pass through
		{
			name:     "User validation error - pass through",
			input:    "Invalid request: 'messages' is a required property",
			expected: "Invalid request: 'messages' is a required property",
		},
		{
			name:     "Empty message",
			input:    "",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := RewriteUpstreamError(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRewriteUpstreamErrorStrict_DefaultAndRequestID(t *testing.T) {
	MaskUpstreamErrors = true

	result := RewriteUpstreamErrorStrict("provider-specific unknown failure (request id: req_123)")
	assert.Equal(t, DefaultUpstreamErrorMessage+" (request id: req_123)", result)
}

func TestRewriteUpstreamError_Disabled(t *testing.T) {
	MaskUpstreamErrors = false
	defer func() { MaskUpstreamErrors = true }()

	input := "You exceeded your current quota, please check your plan and billing details."
	result := RewriteUpstreamError(input)
	assert.Equal(t, input, result, "Should return original message when masking is disabled")
}
