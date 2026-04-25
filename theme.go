package main

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/tailscale/hujson"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// OpenVSXFiles represents the nested files object from OpenVSX
type OpenVSXFiles struct {
	Download string `json:"download"`
	Icon     string `json:"icon"`
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
	DownloadCount int        `json:"downloadCount"`
	DownloadURL string       `json:"downloadUrl"` // We build this or use from API
}

// OpenVSXSearchResponse is the response from the search API
type OpenVSXSearchResponse struct {
	Results []OpenVSXExtension `json:"extensions"`
}

type openVSXLatestResponse struct {
	Categories    []string     `json:"categories"`
	Tags          []string     `json:"tags"`
	DownloadCount int          `json:"downloadCount"`
	Files         OpenVSXFiles `json:"files"`
}

// CustomTheme is the result sent back to frontend
type CustomTheme struct {
	ID     string            `json:"id"`
	Colors map[string]string `json:"colors"`
	Type   string            `json:"type"` // "dark" or "light"
}

type manifestThemeEntry struct {
	Label   string `json:"label"`
	Path    string `json:"path"`
	UITheme string `json:"uiTheme"` // e.g. vs-dark
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
	"editorLineNumber.foreground": true,
	"scrollbarSlider.background":         true,
	"scrollbarSlider.hoverBackground":    true,
	"scrollbarSlider.activeBackground":   true,
	"scrollbar.shadow":                   true,
	"editorError.foreground": true,
	"problemsErrorIcon.foreground": true,
	"textLink.foreground": true,
	"symbolIcon.functionForeground": true,
	"symbolIcon.variableForeground": true,
	"tokenColor.function":           true,
	"tokenColor.variable":           true,
	"tokenColor.number":             true,
	"tokenColor.operator":           true,
	"tokenColor.constant":           true,
	"tokenColor.punctuation":        true,
	"tokenColor.comment":            true,
	"tokenColor.keyword":            true,
	"tokenColor.string":             true,
}

// Strict regex for valid colors (hex, rgb, rgba)
var validColorRegex = regexp.MustCompile(`^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[0-9.]+\s*)?\))$`)

const maxOpenVSXSearchResponseBytes = 2 * 1024 * 1024
const maxOpenVSXMetadataResponseBytes = 512 * 1024
const maxThemeVSIXBytes = 25 * 1024 * 1024
const maxThemeManifestBytes = 2 * 1024 * 1024
const maxThemeJSONBytes = 8 * 1024 * 1024

var allowedThemeDownloadHosts = map[string]struct{}{
	"open-vsx.org": {},
}

func normalizeThemeDownloadURL(rawURL string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return "", fmt.Errorf("invalid theme download URL")
	}
	if !strings.EqualFold(parsed.Scheme, "https") {
		return "", fmt.Errorf("theme download must use HTTPS")
	}
	host := strings.ToLower(strings.TrimSpace(parsed.Hostname()))
	if host == "" {
		return "", fmt.Errorf("theme download host is empty")
	}
	if _, ok := allowedThemeDownloadHosts[host]; !ok {
		return "", fmt.Errorf("theme download host is not allowed")
	}
	return parsed.String(), nil
}

func readZipFileLimited(file *zip.File, maxBytes uint64, fileLabel string) ([]byte, error) {
	if file.UncompressedSize64 > maxBytes {
		return nil, fmt.Errorf("%s is too large in archive", fileLabel)
	}

	rc, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	limited := io.LimitReader(rc, int64(maxBytes)+1)
	content, err := io.ReadAll(limited)
	if err != nil {
		return nil, err
	}
	if uint64(len(content)) > maxBytes {
		return nil, fmt.Errorf("%s is too large in archive", fileLabel)
	}

	return content, nil
}

func isThemeByMetadata(data openVSXLatestResponse) bool {
	for _, category := range data.Categories {
		if strings.EqualFold(strings.TrimSpace(category), "Themes") {
			return true
		}
	}

	for _, tag := range data.Tags {
		normalized := strings.ToLower(strings.TrimSpace(tag))
		if normalized == "theme" || normalized == "color-theme" {
			return true
		}
	}

	return false
}

func fetchLatestMetadata(ctx context.Context, client *http.Client, namespace string, name string) (openVSXLatestResponse, error) {
	endpoint := fmt.Sprintf("https://open-vsx.org/api/%s/%s/latest", url.PathEscape(namespace), url.PathEscape(name))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return openVSXLatestResponse{}, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return openVSXLatestResponse{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return openVSXLatestResponse{}, fmt.Errorf("metadata status: %d", resp.StatusCode)
	}

	limitedBody := io.LimitReader(resp.Body, maxOpenVSXMetadataResponseBytes)
	var data openVSXLatestResponse
	if err := json.NewDecoder(limitedBody).Decode(&data); err != nil {
		return openVSXLatestResponse{}, err
	}

	return data, nil
}

func normalizeThemePath(rawPath string) string {
	return filepath.ToSlash(filepath.Clean(strings.TrimPrefix(rawPath, "./")))
}

func isJSONThemePath(path string) bool {
	lower := strings.ToLower(path)
	return strings.HasSuffix(lower, ".json") || strings.HasSuffix(lower, ".jsonc")
}

func selectInstallableTheme(themes []manifestThemeEntry) (string, string, error) {
	if len(themes) == 0 {
		return "", "", errors.New("no themes contributed by this extension")
	}

	for _, t := range themes {
		clean := normalizeThemePath(t.Path)
		if isJSONThemePath(clean) {
			return clean, t.UITheme, nil
		}
	}

	return "", "", errors.New("theme format not supported: extension has no JSON/JSONC theme file")
}

func (a *App) beginThemeSearch() (context.Context, uint64) {
	a.themeSearchMu.Lock()
	defer a.themeSearchMu.Unlock()

	if a.themeSearchCancel != nil {
		a.themeSearchCancel()
		a.themeSearchCancel = nil
	}

	base := a.ctx
	if base == nil {
		base = context.Background()
	}

	ctx, cancel := context.WithCancel(base)
	a.themeSearchCancel = cancel
	a.themeSearchActiveID++

	return ctx, a.themeSearchActiveID
}

func (a *App) endThemeSearch(searchID uint64) {
	a.themeSearchMu.Lock()
	defer a.themeSearchMu.Unlock()

	if a.themeSearchActiveID != searchID {
		return
	}

	if a.themeSearchCancel != nil {
		a.themeSearchCancel()
		a.themeSearchCancel = nil
	}
}

// SearchThemes calls Open VSX API
func (a *App) SearchThemes(query string) ([]OpenVSXExtension, error) {
	ctx, searchID := a.beginThemeSearch()
	defer a.endThemeSearch(searchID)

	searchQuery := strings.TrimSpace(query)
	if searchQuery == "" {
		searchQuery = "theme"
	}

	// Keep result set bounded; we re-verify each extension as a true theme for safety.
	reqURL := fmt.Sprintf("https://open-vsx.org/api/-/search?query=%s&size=30", url.QueryEscape(searchQuery))
	
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %v", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return nil, context.Canceled
		}
		return nil, fmt.Errorf("failed to contact Open VSX: %v", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}
	
	limitedBody := io.LimitReader(resp.Body, maxOpenVSXSearchResponseBytes)
	var data OpenVSXSearchResponse
	if err := json.NewDecoder(limitedBody).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to parse JSON response: %v", err)
	}
	
	filtered := make([]OpenVSXExtension, 0, len(data.Results))
	for i := range data.Results {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		ext := data.Results[i]
		meta, err := fetchLatestMetadata(ctx, client, ext.Namespace, ext.Name)
		if err != nil {
			if errors.Is(err, context.Canceled) {
				return nil, context.Canceled
			}
			continue
		}
		if !isThemeByMetadata(meta) {
			continue
		}

		if ext.Files.Download != "" {
			ext.DownloadURL = ext.Files.Download
		} else if ext.DownloadURL == "" {
			ns := ext.Namespace
			n := ext.Name
			v := ext.Version
			ext.DownloadURL = fmt.Sprintf("https://open-vsx.org/api/%s/%s/%s/file/%s-%s-%s.vsix", ns, n, v, ns, n, v)
		}

		if ext.Files.Icon == "" {
			ext.Files.Icon = meta.Files.Icon
		}
		if ext.DownloadCount == 0 {
			ext.DownloadCount = meta.DownloadCount
		}

		filtered = append(filtered, ext)
	}

	sort.SliceStable(filtered, func(i, j int) bool {
		return filtered[i].DownloadCount > filtered[j].DownloadCount
	})

	return filtered, nil
}

// tokenColorRule represents a single entry in the VS Code theme tokenColors array.
type tokenColorRule struct {
	Scope    interface{}            `json:"scope"` // string or []string
	Settings map[string]string      `json:"settings"`
}

// scopeToTokenKey maps TextMate scope prefixes to our synthetic token color keys.
// Order matters: first match wins per category, so more specific scopes come first.
var scopeToTokenKey = []struct {
	prefix string
	key    string
}{
	// Functions
	{"support.function", "tokenColor.function"},
	{"entity.name.function", "tokenColor.function"},
	// Variables
	{"variable.other", "tokenColor.variable"},
	{"variable", "tokenColor.variable"},
	// Numbers
	{"constant.numeric", "tokenColor.number"},
	// Operators
	{"keyword.operator", "tokenColor.operator"},
	// Constants (language builtins like true/false/nil, also math constants)
	{"constant.language", "tokenColor.constant"},
	{"support.constant", "tokenColor.constant"},
	{"constant.other", "tokenColor.constant"},
	// Punctuation
	{"punctuation", "tokenColor.punctuation"},
	// Comments
	{"comment", "tokenColor.comment"},
	// Keywords
	{"keyword", "tokenColor.keyword"},
	// Strings
	{"string", "tokenColor.string"},
}

// extractTokenColors walks the tokenColors array and picks the first foreground
// color for each synthetic key we care about.
func extractTokenColors(rules []tokenColorRule) map[string]string {
	found := make(map[string]string)

	for _, rule := range rules {
		fg := rule.Settings["foreground"]
		if fg == "" {
			continue
		}
		fg = strings.TrimSpace(fg)
		if !validColorRegex.MatchString(fg) {
			continue
		}

		scopes := normalizeScopes(rule.Scope)
		for _, scope := range scopes {
			scope = strings.TrimSpace(scope)
			for _, mapping := range scopeToTokenKey {
				if _, exists := found[mapping.key]; exists {
					continue // already found a color for this key
				}
				if strings.HasPrefix(scope, mapping.prefix) {
					found[mapping.key] = fg
				}
			}
		}
	}

	return found
}

// normalizeScopes converts the scope field (string or []string) into a []string.
func normalizeScopes(raw interface{}) []string {
	switch v := raw.(type) {
	case string:
		// Some themes use comma-separated scopes in a single string
		parts := strings.Split(v, ",")
		result := make([]string, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				result = append(result, p)
			}
		}
		return result
	case []interface{}:
		result := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				result = append(result, strings.TrimSpace(s))
			}
		}
		return result
	default:
		return nil
	}
}

// InstallTheme downloads the VSIX, unzips in memory, and parses styles
func (a *App) InstallTheme(extensionId string, downloadURL string) (*CustomTheme, error) {
	safeURL, err := normalizeThemeDownloadURL(downloadURL)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(safeURL)
	if err != nil {
		return nil, fmt.Errorf("failed to download VSIX: %v", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to download VSIX, status: %d", resp.StatusCode)
	}

	if resp.ContentLength > maxThemeVSIXBytes {
		return nil, fmt.Errorf("theme package is too large")
	}
	
	buf, err := io.ReadAll(io.LimitReader(resp.Body, maxThemeVSIXBytes+1))
	if err != nil {
		return nil, fmt.Errorf("failed to read VSIX stream: %v", err)
	}
	if len(buf) > maxThemeVSIXBytes {
		return nil, fmt.Errorf("theme package is too large")
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
			packageJSON, err = readZipFileLimited(file, maxThemeManifestBytes, "package.json")
			if err != nil {
				return nil, err
			}
			break
		}
	}
	
	if packageJSON == nil {
		return nil, errors.New("package.json not found in VSIX")
	}
	
	// Parse package.json
	var manifest struct {
		Contributes struct {
			Themes []manifestThemeEntry `json:"themes"`
		} `json:"contributes"`
	}
	if err := json.Unmarshal(packageJSON, &manifest); err != nil {
		return nil, fmt.Errorf("failed to parse package.json: %v", err)
	}

	cleanThemePath, uiTheme, err := selectInstallableTheme(manifest.Contributes.Themes)
	if err != nil {
		return nil, err
	}
	targetFile := "extension/" + cleanThemePath
	
	var themeJSON []byte
	for _, file := range zipReader.File {
		if filepath.ToSlash(filepath.Clean(file.Name)) == targetFile {
			themeJSON, err = readZipFileLimited(file, maxThemeJSONBytes, cleanThemePath)
			if err != nil {
				return nil, err
			}
			break
		}
	}
	
	if themeJSON == nil {
		return nil, fmt.Errorf("theme file %s not found in archive", targetFile)
	}
	
	// 2. Parse theme JSON. VS Code themes often use JSONC (comments/trailing commas).
	themeJSONStr := string(themeJSON)
	themeJSONStr = strings.TrimSpace(strings.TrimPrefix(themeJSONStr, "\ufeff"))
	if strings.HasPrefix(themeJSONStr, "<") {
		return nil, errors.New("theme incompatible: expected JSON/JSONC theme file, but found XML/plist")
	}

	jsoncAST, err := hujson.Parse([]byte(themeJSONStr))
	if err != nil {
		return nil, fmt.Errorf("theme incompatible: unable to parse %s as JSON/JSONC", cleanThemePath)
	}
	jsoncAST.Standardize()
	standardJSON := jsoncAST.Pack()
	
	var themeData struct {
		Type        string            `json:"type"` // dark or light
		Colors      map[string]string `json:"colors"`
		TokenColors []tokenColorRule  `json:"tokenColors"`
	}
	if err := json.Unmarshal(standardJSON, &themeData); err != nil {
		return nil, fmt.Errorf("theme incompatible: unable to read colors from %s", cleanThemePath)
	}
	
	// 3. Filter workbench colors strictly
	validColors := make(map[string]string)
	for k, v := range themeData.Colors {
		if allowedColors[k] {
			vTrim := strings.TrimSpace(v)
			if validColorRegex.MatchString(vTrim) {
				validColors[k] = vTrim
			}
		}
	}

	// 4. Extract syntax colors from tokenColors (TextMate scopes)
	tokenSyntax := extractTokenColors(themeData.TokenColors)
	for k, v := range tokenSyntax {
		if allowedColors[k] {
			validColors[k] = v
		}
	}

	// 5. Determine theme base type (dark or light)
	themeType := strings.ToLower(strings.TrimSpace(themeData.Type))
	if themeType != "dark" && themeType != "light" {
		// Fall back to manifest uiTheme field
		switch strings.ToLower(uiTheme) {
		case "vs-dark", "hc-black":
			themeType = "dark"
		default:
			themeType = "light"
		}
	}

	result := &CustomTheme{
		ID:     extensionId,
		Colors: validColors,
		Type:   themeType,
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
