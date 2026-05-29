package common

import "strings"

func ReplaceAllCaseInsensitive(s, old, new string) string {
	if s == "" || old == "" {
		return s
	}
	lowerS := strings.ToLower(s)
	lowerOld := strings.ToLower(old)
	var b strings.Builder
	start := 0
	for {
		idx := strings.Index(lowerS[start:], lowerOld)
		if idx < 0 {
			b.WriteString(s[start:])
			break
		}
		idx += start
		b.WriteString(s[start:idx])
		b.WriteString(new)
		start = idx + len(old)
	}
	return b.String()
}
