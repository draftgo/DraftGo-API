package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeTokenFallbackModelsPreservesOrder(t *testing.T) {
	token := &model.Token{FallbackModels: `[" model-a ","model-b"]`}

	require.NoError(t, normalizeTokenFallbackModels(token))
	assert.Equal(t, `["model-a","model-b"]`, token.FallbackModels)
	assert.Equal(t, []string{"model-a", "model-b"}, token.GetFallbackModels())
}

func TestNormalizeTokenFallbackModelsRejectsInvalidLists(t *testing.T) {
	tests := []struct {
		name  string
		value string
	}{
		{name: "not an array", value: `{}`},
		{name: "empty model", value: `[" "]`},
		{name: "duplicate model", value: `["model-a"," model-a "]`},
		{name: "too many models", value: `["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q"]`},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			token := &model.Token{FallbackModels: test.value}
			assert.Error(t, normalizeTokenFallbackModels(token))
		})
	}
}
