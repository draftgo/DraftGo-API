package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestHandlerMultiKeyUpdateEnablesSingleAutoDisabledKey(t *testing.T) {
	channel := &Channel{
		Id:     1,
		Key:    "key-a\nkey-b",
		Status: common.ChannelStatusEnabled,
		ChannelInfo: ChannelInfo{
			IsMultiKey: true,
			MultiKeyStatusList: map[int]int{
				1: common.ChannelStatusAutoDisabled,
			},
			MultiKeyDisabledReason: map[int]string{
				1: "401",
			},
			MultiKeyDisabledTime: map[int]int64{
				1: 123,
			},
		},
	}

	handlerMultiKeyUpdate(channel, "key-b", common.ChannelStatusEnabled, "")

	if _, ok := channel.ChannelInfo.MultiKeyStatusList[1]; ok {
		t.Fatalf("expected key status to be cleared")
	}
	if _, ok := channel.ChannelInfo.MultiKeyDisabledReason[1]; ok {
		t.Fatalf("expected disabled reason to be cleared")
	}
	if _, ok := channel.ChannelInfo.MultiKeyDisabledTime[1]; ok {
		t.Fatalf("expected disabled time to be cleared")
	}
	if channel.Status != common.ChannelStatusEnabled {
		t.Fatalf("expected channel status enabled, got %d", channel.Status)
	}
}

func TestHandlerMultiKeyUpdateRestoresChannelWhenAKeyRecovers(t *testing.T) {
	channel := &Channel{
		Id:     1,
		Key:    "key-a\nkey-b",
		Status: common.ChannelStatusAutoDisabled,
		ChannelInfo: ChannelInfo{
			IsMultiKey: true,
			MultiKeyStatusList: map[int]int{
				0: common.ChannelStatusAutoDisabled,
				1: common.ChannelStatusAutoDisabled,
			},
		},
	}

	handlerMultiKeyUpdate(channel, "key-a", common.ChannelStatusEnabled, "")

	if _, ok := channel.ChannelInfo.MultiKeyStatusList[0]; ok {
		t.Fatalf("expected recovered key status to be cleared")
	}
	if channel.ChannelInfo.MultiKeyStatusList[1] != common.ChannelStatusAutoDisabled {
		t.Fatalf("expected other key to remain auto-disabled")
	}
	if channel.Status != common.ChannelStatusEnabled {
		t.Fatalf("expected channel status enabled after one key recovers, got %d", channel.Status)
	}
}
