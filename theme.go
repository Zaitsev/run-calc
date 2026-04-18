package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// OpenVSXFiles represents the nested files object from OpenVSX
type OpenVSXFiles struct {
	Download string `json:"download"`
}

// OpenVSXExtension represents the essential data from the search API
type OpenVSXExtension struct {
	Namespace   string       `json:"namespace"`
	Name        string       `json:"name"`
	Publisher   string       `json:"publisher"`
	DisplayName string       `json:"displayName"`
	Description string       `json:"description"`
	Version     string       `json:"version"`
	URL         string       `json:"url"` // usually the page, not the download
	Files       OpenVSXFiles `json:"files"`
	DownloadURL string       `json:"downloadUrl"` // We build this or use from API
}

// OpenVSXSearchResponse is the response from the search API
type OpenVSXSearchResponse struct {
	Results []OpenVSXExtension `json:"extensions"`
}

// CustomTheme is the result sent back to frontend
type CustomTheme struct {
	ID     string            `json:"id"`
	Colors map[string]string `json:"colors"`
}

// Allowed color keys - we only parse these to avoid injection
var allowedColors = map[string]bool{
	"editor.background": true,
	"editor.foreground": true,
	"statusBar.background": true,
	"statusBar.border": true,
	"statusBar.foreground": true,
	"statusBarItem.errorBackground": true,
	"sideBar.background": true,
	"sideBarSectionHeader.background": true,
	"sideBar.border": true,
	"sideBarTitle.foreground": true,
	"descriptionForeground": true,
	"editorGutter.background": true,
	"editorGroup.border": true,
	"editorLineNumber.activeForeground": true,
	"editorError.foreground": true,
	"problemsErrorIcon.foreground": true,
	"textLink.foreground": true,
}

// Strict regex for valid colors (hex, rgb, rgba)
var validColorRegex = regexp.MustCompile(`^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[0-9.]+\s*)?\))$`)

// SearchThemes calls Open VSX API
func (a *App) SearchThemes(query string) ([]OpenVSXExtension, error) {
	// e.g. https://open-vsx.org/api/-/search?query=dracula&extensionFilter=theme
	reqURL := fmt.Sprintf("https://open-vsx.org/api/-/search?query=%s&extensionFilter=theme", url.QueryEscape(query))
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(reqURL)
	if err != nil {
		return nil, fmt.Errorf("failed to contact Open VSX: %v", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}
	
	var data OpenVSXSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to parse JSON response: %v", err)
	}
	
	// API puts download url inside files.download
	for i := range data.Results {
		if data.Results[i].Files.Download != "" {
			data.Results[i].DownloadURL = data.Results[i].Files.Download
		} else if data.Results[i].DownloadURL == "" {
			ns := data.Results[i].Namespace
			n := data.Results[i].Name
			v := data.Results[i].Version
			data.Results[i].DownloadURL = fmt.Sprintf("https://open-vsx.org/api/%s/%s/%s/file/%s-%s-%s.vsix", ns, n, v, ns, n, v)
		}
	}
	
	return data.Results, nil
}

// InstallTheme downloads the VSIX, unzips in memory, and parses styles
func (a *App) InstallTheme(extensionId string, downloadURL string) (*CustomTheme, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(downloadURL)
	if err != nil {
		return nil, fmt.Errorf("failed to download VSIX: %v", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to download VSIX, status: %d", resp.StatusCode)
	}
	
	buf, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read VSIX stream: %v", err)
	}
	
	zipReader, err := zip.NewReader(bytes.NewReader(buf), int64(len(buf)))
	if err != nil {
		return nil, fmt.Errorf("invalid VSIX archive: %v", err)
	}
	
	// 1. Find package.json to get contributes.themes
	var packageJSON []byte
	for _, file := range zipReader.File {
		// Stop ZipSlip by cleaning path
		cleanPath := filepath.ToSlash(filepath.Clean(file.Name))
		if cleanPath == "extension/package.json" {
			rc, err := file.Open()
			if err != nil {
				return nil, err
			}
			packageJSON, err = io.ReadAll(rc)
			rc.Close()
			break
		}
	}
	
	if packageJSON == nil {
		return nil, errors.New("package.json not found in VSIX")
	}
	
	// Parse package.json
	var manifest struct {
		Contributes struct {
			Themes []struct {
				Label string `json:"label"`
				Path  string `json:"path"`
				UITheme string `json:"uiTheme"` // e.g. vs-dark
			} `json:"themes"`
		} `json:"contributes"`
	}
	if err := json.Unmarshal(packageJSON, &manifest); err != nil {
		return nil, fmt.Errorf("failed to parse package.json: %v", err)
	}
	
	if len(manifest.Contributes.Themes) == 0 {
		return nil, errors.New("no themes contributed by this extension")
	}
	
	// Select first theme for simplicity, or we could pass UITheme mapping
	themePath := manifest.Contributes.Themes[0].Path
	// Usually path is "./themes/dracula.json". Let's clean it.
	cleanThemePath := filepath.ToSlash(filepath.Clean(strings.TrimPrefix(themePath, "./")))
	targetFile := "extension/" + cleanThemePath
	
	var themeJSON []byte
	for _, file := range zipReader.File {
		if filepath.ToSlash(filepath.Clean(file.Name)) == targetFile {
			rc, err := file.Open()
			if err != nil {
				return nil, err
			}
			themeJSON, err = io.ReadAll(rc)
			rc.Close()
			break
		}
	}
	
	if themeJSON == nil {
		return nil, fmt.Errorf("theme file %s not found in archive", targetFile)
	}
	
	// 2. Parse theme JSON. Note that VS Code themes are often JSON with Comments.
	// We'll run a naive strip comments.
	themeJSONStr := string(themeJSON)
	reComments := regexp.MustCompile(`(?m)^\s*//.*$`)
	themeJSONStr = reComments.ReplaceAllString(themeJSONStr, "")
	// Also block comments like /* ... */
	reBlockComments := regexp.MustCompile(`(?s)/\*.*?\*/`)
	themeJSONStr = reBlockComments.ReplaceAllString(themeJSONStr, "")
	
	var themeData struct {
		Type string `json:"type"` // dark or light
		Colors map[string]string `json:"colors"`
	}
	if err := json.Unmarshal([]byte(themeJSONStr), &themeData); err != nil {
		return nil, fmt.Errorf("failed to parse theme json: %v", err)
	}
	
	// 3. Filter strictly
	validColors := make(map[string]string)
	for k, v := range themeData.Colors {
		if allowedColors[k] {
			vTrim := strings.TrimSpace(v)
			if validColorRegex.MatchString(vTrim) {
				validColors[k] = vTrim
			}
		}
	}
	
	// Set some defaults if not provided but uiTheme is dark, e.g. for html-bg vs window-bg
	// In the frontend we map the strict tokens back to css vars
	result := &CustomTheme{
		ID: extensionId,
		Colors: validColors,
	}
	
	return result, nil
}

// OpenThemeStore opens a standalone Wails window for the Theme Store
func (a *App) OpenThemeStore() {
    // In Wails v2, spawning native windows from the backend dynamically isn't officially out of the box 
	// unless using specific hacks. A common approach: just emit an event, and the frontend opens it via React Router
	// or modal popup taking up screen, or via frontend Window api. Let's emit an event asking to show the Theme Store.
	runtime.EventsEmit(a.ctx, "theme-store:open")
}
