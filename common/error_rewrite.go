package common

import (
	"strings"
)

// MaskUpstreamErrors controls whether upstream provider error messages
// are rewritten to generic messages before being returned to API users.
// When enabled, error messages that reveal upstream provider details
// (e.g., "Invalid API key", "You exceeded your current quota") are
// replaced with generic equivalents that don't expose backend infrastructure.
//
// This does NOT affect:
// - Admin channel test responses (they use a separate code path)
// - User's own request validation errors (e.g., invalid parameters)
// - Internal error logging (original messages are always logged)
var MaskUpstreamErrors = true

const DefaultUpstreamErrorMessage = "系统负载过重或请求格式错误，请重试"

// upstreamErrorRule defines a rewrite rule for upstream error messages.
type upstreamErrorRule struct {
	// keywords to match (case-insensitive) in the error message
	keywords []string
	// replacement message to return to the user
	replacement string
}

// upstreamErrorRules defines the rewrite rules for upstream error messages.
// Rules are evaluated in order; the first match wins.
var upstreamErrorRules = []upstreamErrorRule{
	// Authentication errors - hide which provider's key is invalid
	{
		keywords:    []string{"invalid api key", "invalid x-api-key", "incorrect api key", "invalid_api_key", "authentication_error", "invalid auth"},
		replacement: "认证失败，请检查密钥或连通性",
	},
	// Quota/billing errors - hide upstream account status
	{
		keywords:    []string{"exceeded your current quota", "insufficient_quota", "billing hard limit", "account deactivated", "credit balance is too low", "rate_limit_exceeded", "quota exceeded"},
		replacement: "服务容量暂时受限，请稍后重试",
	},
	// Rate limiting - generic message
	{
		keywords:    []string{"rate limit", "too many requests", "throttl"},
		replacement: "请求过于频繁，请稍后重试",
	},
	// Model not found - hide upstream model catalog
	{
		keywords:    []string{"model not found", "does not exist", "model_not_found", "no such model", "is not available"},
		replacement: "所请求的模型当前不可用",
	},
	// Content policy / moderation errors - keep useful guidance without
	// exposing provider policy wording.
	{
		keywords:    []string{"content policy", "safety", "blocked", "violate", "violation", "moderation", "审核", "安全策略", "敏感"},
		replacement: "请求内容未通过安全策略，请调整后重试",
	},

	// Upstream new-api / one-api instance errors (Chinese) - hide upstream group/channel details
	{
		keywords:    []string{"可用渠道不存在", "可用渠道失败"},
		replacement: "所请求的模型当前不可用，请稍后重试",
	},
	{
		keywords:    []string{"当前分组负载已饱和", "上游负载已饱和"},
		replacement: "模型请求压力过大，请稍后重试",
	},
	// Server errors - hide upstream provider identity
	{
		keywords:    []string{"internal server error", "bad gateway", "service unavailable", "gateway timeout", "overloaded"},
		replacement: DefaultUpstreamErrorMessage,
	},
	// Permission/access errors
	{
		keywords:    []string{"permission denied", "access denied", "forbidden", "not allowed to"},
		replacement: "当前请求无法访问该资源",
	},
	// Context length errors - these are useful for users, pass through with generic wording
	{
		keywords:    []string{"context length", "maximum context", "token limit", "too many tokens", "max_tokens"},
		replacement: "请求内容超过该模型的上下文长度限制",
	},
}

// RewriteUpstreamError checks if the error message contains upstream provider
// details and returns a sanitized version if MaskUpstreamErrors is enabled.
// Returns the original message if no rewrite rule matches or if masking is disabled.
func RewriteUpstreamError(message string) string {
	if !MaskUpstreamErrors {
		return message
	}
	if message == "" {
		return message
	}

	messageWithoutRequestID, requestIDSuffix := splitRequestIDSuffix(message)
	lowerMessage := strings.ToLower(messageWithoutRequestID)

	for _, rule := range upstreamErrorRules {
		for _, keyword := range rule.keywords {
			if strings.Contains(lowerMessage, keyword) {
				return rule.replacement + requestIDSuffix
			}
		}
	}

	return message
}

// RewriteUpstreamErrorStrict always returns a built-in client-safe message for
// upstream errors. If no rule matches, it falls back to the default overload
// message instead of returning the provider's original message.
func RewriteUpstreamErrorStrict(message string) string {
	if message == "" {
		return DefaultUpstreamErrorMessage
	}

	messageWithoutRequestID, requestIDSuffix := splitRequestIDSuffix(message)
	lowerMessage := strings.ToLower(messageWithoutRequestID)

	for _, rule := range upstreamErrorRules {
		for _, keyword := range rule.keywords {
			if strings.Contains(lowerMessage, keyword) {
				return rule.replacement + requestIDSuffix
			}
		}
	}

	return DefaultUpstreamErrorMessage + requestIDSuffix
}

// SanitizeUpstreamError hides upstream provider details before returning an
// error message to API users.
func SanitizeUpstreamError(message string) string {
	return MaskSensitiveInfo(RewriteUpstreamError(message))
}

// SanitizeUpstreamErrorStrict hides upstream provider details and never returns
// the original upstream error message.
func SanitizeUpstreamErrorStrict(message string) string {
	return MaskSensitiveInfo(RewriteUpstreamErrorStrict(message))
}

func splitRequestIDSuffix(message string) (string, string) {
	const marker = " (request id: "
	index := strings.LastIndex(message, marker)
	if index == -1 || !strings.HasSuffix(message, ")") {
		return message, ""
	}
	return message[:index], message[index:]
}
