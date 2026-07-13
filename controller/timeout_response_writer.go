package controller

import (
	"bufio"
	"bytes"
	"net"
	"net/http"
	"sync"
)

type timeoutResponseWriter struct {
	original  http.ResponseWriter
	header    http.Header
	body      bytes.Buffer
	status    int
	committed bool
	mu        sync.Mutex
}

func newTimeoutResponseWriter(original http.ResponseWriter) *timeoutResponseWriter {
	return &timeoutResponseWriter{original: original, header: original.Header().Clone()}
}

func (w *timeoutResponseWriter) Header() http.Header {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.committed {
		return w.original.Header()
	}
	return w.header
}

func (w *timeoutResponseWriter) WriteHeader(code int) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.committed {
		w.original.WriteHeader(code)
		return
	}
	if w.status == 0 {
		w.status = code
	}
}

func (w *timeoutResponseWriter) Write(data []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.committed {
		return w.original.Write(data)
	}
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.body.Write(data)
}

func (w *timeoutResponseWriter) WriteString(data string) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.committed {
		if writer, ok := w.original.(interface{ WriteString(string) (int, error) }); ok {
			return writer.WriteString(data)
		}
		return w.original.Write([]byte(data))
	}
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.body.WriteString(data)
}

func (w *timeoutResponseWriter) Status() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.committed {
		if writer, ok := w.original.(interface{ Status() int }); ok {
			return writer.Status()
		}
	}
	if w.status == 0 {
		return http.StatusOK
	}
	return w.status
}

func (w *timeoutResponseWriter) Size() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.body.Len()
}
func (w *timeoutResponseWriter) Written() bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.committed || w.status != 0
}
func (w *timeoutResponseWriter) WriteHeaderNow() { w.WriteHeader(http.StatusOK) }
func (w *timeoutResponseWriter) Flush() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.committed {
		if flusher, ok := w.original.(http.Flusher); ok {
			flusher.Flush()
		}
	}
}
func (w *timeoutResponseWriter) CloseNotify() <-chan bool {
	if notifier, ok := w.original.(http.CloseNotifier); ok {
		return notifier.CloseNotify()
	}
	ch := make(chan bool)
	return ch
}
func (w *timeoutResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	return w.original.(http.Hijacker).Hijack()
}
func (w *timeoutResponseWriter) Pusher() http.Pusher {
	if pusher, ok := w.original.(http.Pusher); ok {
		return pusher
	}
	return nil
}

func (w *timeoutResponseWriter) CommitTimeoutResponse() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.committed {
		return nil
	}
	destination := w.original.Header()
	for key := range destination {
		destination.Del(key)
	}
	for key, values := range w.header {
		for _, value := range values {
			destination.Add(key, value)
		}
	}
	if w.status != 0 {
		w.original.WriteHeader(w.status)
	}
	var err error
	if w.body.Len() > 0 {
		_, err = w.original.Write(w.body.Bytes())
	}
	w.committed = err == nil
	return err
}

func (w *timeoutResponseWriter) commit() error { return w.CommitTimeoutResponse() }
