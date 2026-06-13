package model

import (
	"bytes"
	"fmt"
)

func scanJSONColumn(value interface{}) ([]byte, bool, error) {
	var bytesValue []byte
	switch v := value.(type) {
	case nil:
		return nil, true, nil
	case []byte:
		bytesValue = bytes.TrimSpace(v)
	case string:
		bytesValue = bytes.TrimSpace([]byte(v))
	default:
		return nil, false, fmt.Errorf("unsupported value type %T", value)
	}
	if len(bytesValue) == 0 || bytes.Equal(bytesValue, []byte("null")) {
		return nil, true, nil
	}
	return bytesValue, false, nil
}
