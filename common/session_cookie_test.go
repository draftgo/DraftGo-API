package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSessionCookieDomainForHost(t *testing.T) {
	tests := []struct {
		name string
		host string
		want string
	}{
		{name: "root domain", host: "routergo.cn", want: ".routergo.cn"},
		{name: "single subdomain", host: "ops.routergo.cn", want: ".routergo.cn"},
		{name: "nested subdomain", host: "a.b.routergo.cn", want: ".routergo.cn"},
		{name: "host with port", host: "routergo.cn:443", want: ".routergo.cn"},
		{name: "uppercase host", host: "RouterGo.CN", want: ".routergo.cn"},
		{name: "public suffix", host: "www.example.co.uk", want: ".example.co.uk"},
		{name: "localhost", host: "localhost", want: ""},
		{name: "ip address", host: "127.0.0.1", want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, SessionCookieDomainForHost(tt.host))
		})
	}
}
