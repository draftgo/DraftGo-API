package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestFormatUserLogsHidesModelMappingDetails(t *testing.T) {
	logs := []*Log{
		{
			Id:                42,
			Other:             `{"billing_source":"wallet","is_model_mapped":true,"model_ratio":37.5,"upstream_model_name":"deepseek-v4-flash","admin_info":{"upstream_model_name":"deepseek-v4-flash"},"stream_status":{"finished":true}}`,
			UpstreamRequestId: "upstream-request-id",
		},
	}

	formatUserLogs(logs, 0)

	if logs[0].Id != 1 {
		t.Fatalf("expected display id to be rewritten, got %d", logs[0].Id)
	}
	if logs[0].UpstreamRequestId != "" {
		t.Fatalf("expected upstream request id to be hidden, got %q", logs[0].UpstreamRequestId)
	}

	other, err := common.StrToMap(logs[0].Other)
	if err != nil {
		t.Fatalf("failed to parse sanitized other: %v", err)
	}
	for _, key := range []string{"admin_info", "is_model_mapped", "upstream_model_name", "stream_status"} {
		if _, ok := other[key]; ok {
			t.Fatalf("expected %s to be hidden from user log other: %s", key, logs[0].Other)
		}
	}
	if other["billing_source"] != "wallet" {
		t.Fatalf("expected billing_source to remain, got %v", other["billing_source"])
	}
}
