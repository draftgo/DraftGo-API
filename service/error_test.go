package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestResetStatusCode(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name             string
		statusCode       int
		statusCodeConfig string
		expectedCode     int
	}{
		{
			name:             "map string value",
			statusCode:       429,
			statusCodeConfig: `{"429":"503"}`,
			expectedCode:     503,
		},
		{
			name:             "map int value",
			statusCode:       429,
			statusCodeConfig: `{"429":503}`,
			expectedCode:     503,
		},
		{
			name:             "skip invalid string value",
			statusCode:       429,
			statusCodeConfig: `{"429":"bad-code"}`,
			expectedCode:     429,
		},
		{
			name:             "skip status code 200",
			statusCode:       200,
			statusCodeConfig: `{"200":503}`,
			expectedCode:     200,
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			newAPIError := &types.NewAPIError{
				StatusCode: tc.statusCode,
			}
			ResetStatusCode(newAPIError, tc.statusCodeConfig)
			require.Equal(t, tc.expectedCode, newAPIError.StatusCode)
		})
	}
}

func TestRelayErrorHandlerTruncatesInvalidJSONBodyInLog(t *testing.T) {
	withDebugEnabled(t, false)

	body := strings.Repeat("b", common.LocalLogContentLimit+256)
	var logBuffer bytes.Buffer

	common.LogWriterMu.Lock()
	oldWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logBuffer
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = oldWriter
		common.LogWriterMu.Unlock()
	})

	resp := &http.Response{
		StatusCode: http.StatusInternalServerError,
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	newAPIError := RelayErrorHandler(context.Background(), resp, false)

	require.NotNil(t, newAPIError)
	require.Equal(t, "bad response status code 500", newAPIError.Error())
	require.Contains(t, logBuffer.String(), "[truncated")
	require.Contains(t, logBuffer.String(), fmt.Sprintf("original_length=%d", len(body)))
	require.NotContains(t, logBuffer.String(), strings.Repeat("b", common.LocalLogContentLimit+1))
}

func TestRelayErrorHandlerKeepsStructuredErrorMessage(t *testing.T) {
	message := strings.Repeat("c", common.LocalLogContentLimit+256)
	body := `{"message":"` + message + `"}`
	resp := &http.Response{
		StatusCode: http.StatusInternalServerError,
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	newAPIError := RelayErrorHandler(context.Background(), resp, false)

	require.NotNil(t, newAPIError)
	require.Equal(t, message, newAPIError.Error())
}

func TestRelayErrorHandlerKeepsOpenAIErrorMessage(t *testing.T) {
	message := strings.Repeat("d", common.LocalLogContentLimit+256)
	body := `{"error":{"message":"` + message + `","type":"server_error","code":"server_error"}}`
	resp := &http.Response{
		StatusCode: http.StatusInternalServerError,
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	newAPIError := RelayErrorHandler(context.Background(), resp, false)

	require.NotNil(t, newAPIError)
	require.Equal(t, message, newAPIError.Error())
}

func TestRelayErrorHandlerFinalOpenAIErrorSanitizesUpstreamURL(t *testing.T) {
	body := `{"error":{"message":"503 Server Error: Service Unavailable for url: https://upstream.example.com/v1/chat/completions","type":"server_error","code":"server_error"}}`
	resp := &http.Response{
		StatusCode: http.StatusServiceUnavailable,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"application/json"}},
	}

	newAPIError := RelayErrorHandler(context.Background(), resp, false)

	require.NotNil(t, newAPIError)
	finalError := newAPIError.ToOpenAIError()
	require.Equal(t, common.DefaultUpstreamErrorMessage, finalError.Message)
	require.NotContains(t, finalError.Message, "upstream.example.com")
}

func TestRelayErrorHandlerFinalOpenAIErrorUsesDefaultForUnknownUpstreamMessage(t *testing.T) {
	body := `{"error":{"message":"provider secret shard alpha returned custom failure for url: https://upstream.example.com/v1/chat/completions","type":"server_error","code":"server_error"}}`
	resp := &http.Response{
		StatusCode: http.StatusBadGateway,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"application/json"}},
	}

	newAPIError := RelayErrorHandler(context.Background(), resp, false)

	require.NotNil(t, newAPIError)
	require.Contains(t, newAPIError.Error(), "provider secret shard alpha")
	finalError := newAPIError.ToOpenAIError()
	require.Equal(t, common.DefaultUpstreamErrorMessage, finalError.Message)
	require.NotContains(t, finalError.Message, "provider secret shard alpha")
	require.NotContains(t, finalError.Message, "upstream.example.com")
}

func TestRelayErrorHandlerChannelTestKeepsOriginalErrorForAdmin(t *testing.T) {
	body := `{"error":{"message":"provider secret shard alpha returned custom failure for url: https://upstream.example.com/v1/chat/completions","type":"server_error","code":"server_error"}}`
	resp := &http.Response{
		StatusCode: http.StatusBadGateway,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"application/json"}},
	}

	newAPIError := RelayErrorHandler(context.Background(), resp, true)

	require.NotNil(t, newAPIError)
	require.Contains(t, newAPIError.Error(), "provider secret shard alpha")
	require.Contains(t, newAPIError.Error(), "upstream.example.com")
}

func TestTaskErrorWrapperSanitizesUpstreamURL(t *testing.T) {
	taskErr := TaskErrorWrapper(
		fmt.Errorf("503 Server Error: Service Unavailable for url: https://upstream.example.com/v1/chat/completions"),
		"fail_to_fetch_task",
		http.StatusServiceUnavailable,
	)

	require.NotNil(t, taskErr)
	require.NotContains(t, taskErr.Message, "upstream.example.com")
	require.Equal(t, common.DefaultUpstreamErrorMessage, taskErr.Message)
}

func TestTaskErrorWrapperSanitizesBareUpstreamDomain(t *testing.T) {
	taskErr := TaskErrorWrapper(
		fmt.Errorf("upstream api.provider.example.com returned overload"),
		"upstream_error",
		http.StatusBadGateway,
	)

	require.NotNil(t, taskErr)
	require.NotContains(t, taskErr.Message, "api.provider.example.com")
	require.Contains(t, taskErr.Message, "***.***.***.com")
}

func TestSanitizeTaskErrorUsesDefaultForUnknownUpstreamMessage(t *testing.T) {
	taskErr := TaskErrorWrapper(
		fmt.Errorf("provider secret shard alpha returned custom failure for url: https://upstream.example.com/v1/jobs"),
		"upstream_error",
		http.StatusBadGateway,
	)

	SanitizeTaskError(taskErr)

	require.NotNil(t, taskErr)
	require.Equal(t, common.DefaultUpstreamErrorMessage, taskErr.Message)
	require.NotContains(t, taskErr.Message, "provider secret shard alpha")
	require.NotContains(t, taskErr.Message, "upstream.example.com")
}

func TestSanitizeTaskErrorKeepsLocalValidationMessage(t *testing.T) {
	taskErr := TaskErrorWrapperLocal(
		fmt.Errorf("prompt is required"),
		"invalid_request",
		http.StatusBadRequest,
	)

	SanitizeTaskError(taskErr)

	require.NotNil(t, taskErr)
	require.Equal(t, "prompt is required", taskErr.Message)
}

func TestTaskErrorWrapperRewritesServiceUnavailable(t *testing.T) {
	taskErr := TaskErrorWrapper(
		fmt.Errorf("Service Unavailable from https://hidden.example.net/v1/jobs"),
		"upstream_error",
		http.StatusServiceUnavailable,
	)

	require.NotNil(t, taskErr)
	require.Equal(t, common.DefaultUpstreamErrorMessage, taskErr.Message)
}

func TestRelayErrorHandlerKeepsInvalidJSONBodyInDebugLog(t *testing.T) {
	withDebugEnabled(t, true)

	body := strings.Repeat("e", common.LocalLogContentLimit+256)
	var logBuffer bytes.Buffer

	common.LogWriterMu.Lock()
	oldWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logBuffer
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = oldWriter
		common.LogWriterMu.Unlock()
	})

	resp := &http.Response{
		StatusCode: http.StatusInternalServerError,
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	newAPIError := RelayErrorHandler(context.Background(), resp, false)

	require.NotNil(t, newAPIError)
	require.NotContains(t, logBuffer.String(), "[truncated")
	require.Contains(t, logBuffer.String(), body)
}

func withDebugEnabled(t *testing.T, enabled bool) {
	t.Helper()

	oldDebug := common.DebugEnabled
	common.DebugEnabled = enabled
	t.Cleanup(func() {
		common.DebugEnabled = oldDebug
	})
}
