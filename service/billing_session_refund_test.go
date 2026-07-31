package service

import (
	"errors"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

type fallbackRefundFunding struct {
	refundCalls int
	refundErr   error
}

func (f *fallbackRefundFunding) Source() string       { return BillingSourceWallet }
func (f *fallbackRefundFunding) PreConsume(int) error { return nil }
func (f *fallbackRefundFunding) Settle(int) error     { return nil }
func (f *fallbackRefundFunding) Refund() error {
	f.refundCalls++
	return f.refundErr
}

func TestBillingSessionRefundSyncIsIdempotent(t *testing.T) {
	c, _ := gin.CreateTestContext(nil)
	funding := &fallbackRefundFunding{}
	session := &BillingSession{
		relayInfo:     &relaycommon.RelayInfo{IsPlayground: true},
		funding:       funding,
		tokenConsumed: 10,
	}

	assert.NoError(t, session.RefundSync(c))
	assert.NoError(t, session.RefundSync(c))
	assert.Equal(t, 1, funding.refundCalls)
}

func TestBillingSessionRefundSyncReturnsFundingError(t *testing.T) {
	c, _ := gin.CreateTestContext(nil)
	wantErr := errors.New("refund failed")
	funding := &fallbackRefundFunding{refundErr: wantErr}
	session := &BillingSession{
		relayInfo:     &relaycommon.RelayInfo{IsPlayground: true},
		funding:       funding,
		tokenConsumed: 10,
	}

	assert.ErrorIs(t, session.RefundSync(c), wantErr)
	assert.Equal(t, 1, funding.refundCalls)
}
