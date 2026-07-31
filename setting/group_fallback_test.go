package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGroupFallbackModelsValidateAndNormalize(t *testing.T) {
	original := GroupFallbackModels2JSONString()
	t.Cleanup(func() { require.NoError(t, UpdateGroupFallbackModelsByJSONString(original)) })

	require.NoError(t, UpdateGroupFallbackModelsByJSONString(`{" default ":[" model-a ","model-b"]}`))
	assert.Equal(t, []string{"model-a", "model-b"}, GetGroupFallbackModels("default"))
	models := GetGroupFallbackModels("default")
	models[0] = "changed"
	assert.Equal(t, "model-a", GetGroupFallbackModels("default")[0])

	assert.Error(t, CheckGroupFallbackModels(`{"default":["model-a"," model-a "]}`))
	assert.Error(t, CheckGroupFallbackModels(`{" ":["model-a"]}`))
	assert.Error(t, CheckGroupFallbackModels(`{"default":["a"]," default ":["b"]}`))
}

func TestGroupFallbackModelsRejectsOversizedLists(t *testing.T) {
	assert.Error(t, CheckGroupFallbackModels(`{"default":["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q"]}`))
}
