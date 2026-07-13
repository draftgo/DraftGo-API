package controller

import "testing"

func TestGetUpstreamURLs(t *testing.T) {
	t.Setenv("SYNC_UPSTREAM_BASE", "https://metadata.example.com/root/")

	tests := []struct {
		name       string
		locale     string
		source     string
		modelsURL  string
		vendorsURL string
	}{
		{
			name:       "official default",
			modelsURL:  "https://metadata.example.com/root/api/newapi/models.json",
			vendorsURL: "https://metadata.example.com/root/api/newapi/vendors.json",
		},
		{
			name:       "official localized",
			locale:     "ja",
			source:     "official",
			modelsURL:  "https://metadata.example.com/root/api/i18n/ja/newapi/models.json",
			vendorsURL: "https://metadata.example.com/root/api/i18n/ja/newapi/vendors.json",
		},
		{
			name:       "draftgo ignores locale",
			locale:     "zh-CN",
			source:     "DraftGo",
			modelsURL:  draftGoModelsURL,
			vendorsURL: draftGoVendorsURL,
		},
		{
			name:       "unknown source falls back to official",
			source:     "unknown",
			modelsURL:  "https://metadata.example.com/root/api/newapi/models.json",
			vendorsURL: "https://metadata.example.com/root/api/newapi/vendors.json",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			modelsURL, vendorsURL := getUpstreamURLs(tt.locale, tt.source)
			if modelsURL != tt.modelsURL {
				t.Fatalf("models URL = %q, want %q", modelsURL, tt.modelsURL)
			}
			if vendorsURL != tt.vendorsURL {
				t.Fatalf("vendors URL = %q, want %q", vendorsURL, tt.vendorsURL)
			}
		})
	}
}
