package model

import "testing"

func TestJSONValueScanTreatsEmptyValuesAsNull(t *testing.T) {
	for _, value := range []interface{}{nil, []byte(""), []byte("  "), []byte("null"), " ", "null"} {
		var items JSONValue
		if err := items.Scan(value); err != nil {
			t.Fatalf("Scan(%#v) returned error: %v", value, err)
		}
		if items != nil {
			t.Fatalf("expected nil JSONValue for %#v, got %q", value, string(items))
		}
	}
}

func TestJSONValueScanKeepsValidJSON(t *testing.T) {
	var items JSONValue
	if err := items.Scan(`["a","b"]`); err != nil {
		t.Fatalf("Scan returned error: %v", err)
	}
	if string(items) != `["a","b"]` {
		t.Fatalf("unexpected JSONValue: %q", string(items))
	}
}

func TestJSONValueScanEncodesLegacyPlainTextAsJSONString(t *testing.T) {
	var items JSONValue
	if err := items.Scan("a,b"); err != nil {
		t.Fatalf("Scan returned error: %v", err)
	}
	if string(items) != `"a,b"` {
		t.Fatalf("unexpected JSONValue: %q", string(items))
	}
}

func TestPropertiesScanSupportsEmptyAndStringValues(t *testing.T) {
	for _, value := range []interface{}{nil, "", []byte("null")} {
		var properties Properties
		if err := properties.Scan(value); err != nil {
			t.Fatalf("Scan(%#v) returned error: %v", value, err)
		}
		if properties != (Properties{}) {
			t.Fatalf("expected default Properties for %#v, got %#v", value, properties)
		}
	}

	var properties Properties
	if err := properties.Scan(`{"input":"hello"}`); err != nil {
		t.Fatalf("Scan returned error: %v", err)
	}
	if properties.Input != "hello" {
		t.Fatalf("unexpected Properties: %#v", properties)
	}
}

func TestTaskPrivateDataScanSupportsEmptyAndStringValues(t *testing.T) {
	for _, value := range []interface{}{nil, "", []byte("null")} {
		var privateData TaskPrivateData
		if err := privateData.Scan(value); err != nil {
			t.Fatalf("Scan(%#v) returned error: %v", value, err)
		}
		if privateData != (TaskPrivateData{}) {
			t.Fatalf("expected default TaskPrivateData for %#v, got %#v", value, privateData)
		}
	}

	var privateData TaskPrivateData
	if err := privateData.Scan(`{"upstream_task_id":"task-1"}`); err != nil {
		t.Fatalf("Scan returned error: %v", err)
	}
	if privateData.UpstreamTaskID != "task-1" {
		t.Fatalf("unexpected TaskPrivateData: %#v", privateData)
	}
}
