package model

import "testing"

func TestChannelInfoScanTreatsEmptyValuesAsDefault(t *testing.T) {
	for _, value := range []interface{}{nil, []byte(""), []byte("  "), []byte("null"), " ", "null"} {
		var info ChannelInfo
		if err := info.Scan(value); err != nil {
			t.Fatalf("Scan(%#v) returned error: %v", value, err)
		}
		if info.IsMultiKey || info.MultiKeySize != 0 || info.MultiKeyStatusList != nil {
			t.Fatalf("expected default ChannelInfo for %#v, got %#v", value, info)
		}
	}
}

func TestChannelInfoScanSupportsStringAndBytes(t *testing.T) {
	for _, value := range []interface{}{
		[]byte(`{"is_multi_key":true,"multi_key_size":2}`),
		`{"is_multi_key":true,"multi_key_size":2}`,
	} {
		var info ChannelInfo
		if err := info.Scan(value); err != nil {
			t.Fatalf("Scan(%#v) returned error: %v", value, err)
		}
		if !info.IsMultiKey || info.MultiKeySize != 2 {
			t.Fatalf("unexpected ChannelInfo for %#v: %#v", value, info)
		}
	}
}

func TestChannelInfoScanRejectsUnsupportedTypes(t *testing.T) {
	var info ChannelInfo
	if err := info.Scan(123); err == nil {
		t.Fatal("expected unsupported type error")
	}
}
