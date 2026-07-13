package controller

import "testing"

func TestGetUpstreamURLs(t *testing.T) {
	t.Setenv("SYNC_UPSTREAM_BASE", "https://metadata.example.com/root/")

	tests := []struct {
		name       string
		locale     string
		source     string
		normalized string
		modelsURL  string
		vendorsURL string
	}{
		{
			name:       "official default",
			normalized: defaultSyncSource,
			modelsURL:  "https://metadata.example.com/root/api/newapi/models.json",
			vendorsURL: "https://metadata.example.com/root/api/newapi/vendors.json",
		},
		{
			name:       "official localized",
			locale:     "ja",
			source:     "official",
			normalized: defaultSyncSource,
			modelsURL:  "https://metadata.example.com/root/api/i18n/ja/newapi/models.json",
			vendorsURL: "https://metadata.example.com/root/api/i18n/ja/newapi/vendors.json",
		},
		{
			name:       "draftgo ignores locale",
			locale:     "zh-CN",
			source:     "DraftGo",
			normalized: draftGoSyncSource,
			modelsURL:  draftGoModelsURL,
			vendorsURL: draftGoVendorsURL,
		},
		{
			name:       "config uses configured upstream",
			locale:     "ja",
			source:     "config",
			normalized: configSyncSource,
			modelsURL:  "https://metadata.example.com/root/api/i18n/ja/newapi/models.json",
			vendorsURL: "https://metadata.example.com/root/api/i18n/ja/newapi/vendors.json",
		},
		{
			name:       "unknown source falls back to official",
			source:     "unknown",
			normalized: defaultSyncSource,
			modelsURL:  "https://metadata.example.com/root/api/newapi/models.json",
			vendorsURL: "https://metadata.example.com/root/api/newapi/vendors.json",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if source := normalizeSyncSource(tt.source); source != tt.normalized {
				t.Fatalf("normalized source = %q, want %q", source, tt.normalized)
			}
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
