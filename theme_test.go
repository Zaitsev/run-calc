package main

import (
	"strings"
	"testing"
)

func TestSelectInstallableThemePrefersJSONTheme(t *testing.T) {
	themes := []manifestThemeEntry{
		{Label: "Legacy", Path: "./themes/legacy.tmTheme", UITheme: "vs-dark"},
		{Label: "Modern", Path: "./themes/modern.json", UITheme: "vs-dark"},
	}

	path, uiTheme, err := selectInstallableTheme(themes)
	if err != nil {
		t.Fatalf("selectInstallableTheme returned unexpected error: %v", err)
	}
	if path != "themes/modern.json" {
		t.Fatalf("expected normalized JSON path, got %q", path)
	}
	if uiTheme != "vs-dark" {
		t.Fatalf("expected uiTheme vs-dark, got %q", uiTheme)
	}
}

func TestSelectInstallableThemeReportsTMThemeIncompatibility(t *testing.T) {
	themes := []manifestThemeEntry{
		{Label: "3024 Day", Path: "./themes/3024_Day.tmTheme", UITheme: "vs"},
		{Label: "3024 Night", Path: "./themes/3024_Night.tmTheme", UITheme: "vs-dark"},
	}

	_, _, err := selectInstallableTheme(themes)
	if err == nil {
		t.Fatal("expected incompatibility error for tmTheme-only extension")
	}
	if !strings.Contains(strings.ToLower(err.Error()), ".tmtheme") {
		t.Fatalf("expected tmTheme-specific error, got %q", err.Error())
	}
}
