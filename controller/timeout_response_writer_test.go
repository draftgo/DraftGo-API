package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTimeoutResponseWriterBuffersUntilCommitThenPassesThrough(t *testing.T) {
	recorder := httptest.NewRecorder()
	writer := newTimeoutResponseWriter(recorder)
	writer.Header().Set("Content-Type", "text/event-stream")

	_, err := writer.WriteString("data: first\n\n")
	require.NoError(t, err)
	assert.Empty(t, recorder.Body.String())

	require.NoError(t, writer.CommitTimeoutResponse())
	assert.Equal(t, "data: first\n\n", recorder.Body.String())
	assert.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))

	_, err = writer.WriteString("data: second\n\n")
	require.NoError(t, err)
	writer.Flush()
	assert.Equal(t, "data: first\n\ndata: second\n\n", recorder.Body.String())
	assert.Equal(t, http.StatusOK, recorder.Code)
}
