package setting

import (
	"errors"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

const MaxFallbackModels = 16

var (
	groupFallbackModelsMu sync.RWMutex
	groupFallbackModels   = map[string][]string{}
)

func CheckGroupFallbackModels(jsonString string) error {
	parsed := make(map[string][]string)
	if err := common.Unmarshal([]byte(jsonString), &parsed); err != nil {
		return err
	}
	normalizedGroups := make(map[string]struct{}, len(parsed))
	for group, models := range parsed {
		group = strings.TrimSpace(group)
		if group == "" {
			return errors.New("fallback model group cannot be empty")
		}
		if _, exists := normalizedGroups[group]; exists {
			return errors.New("duplicate fallback model group " + group)
		}
		normalizedGroups[group] = struct{}{}
		if len(models) > MaxFallbackModels {
			return errors.New("too many fallback models configured for group " + group)
		}
		seen := make(map[string]struct{}, len(models))
		for _, modelName := range models {
			modelName = strings.TrimSpace(modelName)
			if modelName == "" {
				return errors.New("fallback model name cannot be empty")
			}
			if len(modelName) > 128 {
				return errors.New("fallback model name is too long")
			}
			if _, exists := seen[modelName]; exists {
				return errors.New("duplicate fallback model " + modelName + " in group " + group)
			}
			seen[modelName] = struct{}{}
		}
	}
	return nil
}

func UpdateGroupFallbackModelsByJSONString(jsonString string) error {
	if err := CheckGroupFallbackModels(jsonString); err != nil {
		return err
	}
	parsed := make(map[string][]string)
	if err := common.Unmarshal([]byte(jsonString), &parsed); err != nil {
		return err
	}
	normalized := make(map[string][]string, len(parsed))
	for group, models := range parsed {
		cleanModels := make([]string, 0, len(models))
		for _, modelName := range models {
			cleanModels = append(cleanModels, strings.TrimSpace(modelName))
		}
		normalized[strings.TrimSpace(group)] = cleanModels
	}
	groupFallbackModelsMu.Lock()
	groupFallbackModels = normalized
	groupFallbackModelsMu.Unlock()
	return nil
}

func GroupFallbackModels2JSONString() string {
	groupFallbackModelsMu.RLock()
	copyMap := make(map[string][]string, len(groupFallbackModels))
	for group, models := range groupFallbackModels {
		copyMap[group] = append([]string(nil), models...)
	}
	groupFallbackModelsMu.RUnlock()
	jsonBytes, err := common.Marshal(copyMap)
	if err != nil {
		return "{}"
	}
	return string(jsonBytes)
}

func GetGroupFallbackModels(group string) []string {
	groupFallbackModelsMu.RLock()
	models := append([]string(nil), groupFallbackModels[group]...)
	groupFallbackModelsMu.RUnlock()
	return models
}
