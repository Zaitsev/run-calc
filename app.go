package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v2/pkg/options"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.design/x/hotkey"
)

// App struct
type App struct {
	ctx context.Context

	minimiseToTrayOnClose atomic.Bool
	restoreShortcutOn     atomic.Bool
	allowCloseOnce        atomic.Bool

	hotkeyMu      sync.Mutex
	restoreHotkey []*hotkey.Hotkey

	themeSearchMu       sync.Mutex
	themeSearchCancel   context.CancelFunc
	themeSearchActiveID uint64
	aiMu                sync.Mutex
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.minimiseToTrayOnClose.Store(true)
	// Global hotkeys are blocked by the AppContainer sandbox when running as MSIX.
	a.restoreShortcutOn.Store(!isRunningAsMSIX())
	a.startTray()
	a.ensureRestoreHotkeyRegistration()
	a.ShowWindow()
}

func (a *App) shutdown(ctx context.Context) {
	a.stopTray()
	a.unregisterRestoreHotkey()
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

func (a *App) clearWorksheet() {
	wruntime.EventsEmit(a.ctx, "menu:file:new")
}

func (a *App) reloadWindow() {
	wruntime.WindowReload(a.ctx)
}

func (a *App) increaseFontSize() {
	wruntime.EventsEmit(a.ctx, "menu:view:increase-font-size")
}

func (a *App) decreaseFontSize() {
	wruntime.EventsEmit(a.ctx, "menu:view:decrease-font-size")
}

func (a *App) resetWindowLayout() {
	wruntime.EventsEmit(a.ctx, "menu:view:reset-window-layout")
}

func (a *App) resetFontSize() {
	wruntime.EventsEmit(a.ctx, "menu:view:reset-font-size")
}

func (a *App) showAbout() {
	_, _ = wruntime.MessageDialog(a.ctx, wruntime.MessageDialogOptions{
		Type:    wruntime.InfoDialog,
		Title:   "About Run-Calc",
		Message: "Run-Calc is a native Wails desktop calculator with a system menu and standard OS window chrome.",
	})
}

func (a *App) openHelp() {
	wruntime.EventsEmit(a.ctx, "menu:help:open")
}

func (a *App) quit() {
	a.allowCloseOnce.Store(true)
	wruntime.Quit(a.ctx)
}

func (a *App) beforeClose(ctx context.Context) bool {
	if a.allowCloseOnce.Load() {
		a.allowCloseOnce.Store(false)
		return false
	}

	if !a.minimiseToTrayOnClose.Load() {
		return false
	}

	wruntime.WindowHide(ctx)
	return true
}

func (a *App) ShowWindow() {
	if a.ctx == nil {
		return
	}

	wruntime.WindowShow(a.ctx)
	wruntime.WindowUnminimise(a.ctx)

	// Toggle always-on-top briefly to reliably bring restored tray windows to front on Windows.
	if runtime.GOOS == "windows" {
		wruntime.WindowSetAlwaysOnTop(a.ctx, true)
		go func(ctx context.Context) {
			time.Sleep(120 * time.Millisecond)
			wruntime.WindowSetAlwaysOnTop(ctx, false)
		}(a.ctx)
	}
}

func (a *App) onSecondInstanceLaunch(_ options.SecondInstanceData) {
	a.ShowWindow()
}

func (a *App) SetMinimiseToTrayOnClose(enabled bool) {
	a.minimiseToTrayOnClose.Store(enabled)
}

func (a *App) SetRestoreShortcutEnabled(enabled bool) {
	if isRunningAsMSIX() {
		return // hotkeys unavailable in AppContainer sandbox
	}
	a.restoreShortcutOn.Store(enabled)
	a.ensureRestoreHotkeyRegistration()
}

// IsRunningAsMSIX reports whether the app is running inside an MSIX package.
// When true, global hotkeys are unavailable due to AppContainer sandbox restrictions.
func (a *App) IsRunningAsMSIX() bool {
	return isRunningAsMSIX()
}

func (a *App) ensureRestoreHotkeyRegistration() {
	a.hotkeyMu.Lock()
	defer a.hotkeyMu.Unlock()

	if !a.restoreShortcutOn.Load() {
		a.unregisterRestoreHotkeyLocked()
		return
	}

	if len(a.restoreHotkey) > 0 {
		return
	}

	registered := make([]*hotkey.Hotkey, 0, 2)
	for _, spec := range restoreHotkeySpecs() {
		hk := hotkey.New(spec.mods, spec.key)
		if err := hk.Register(); err != nil {
			continue
		}

		registered = append(registered, hk)
		go func(h *hotkey.Hotkey) {
			for range h.Keydown() {
				a.ShowWindow()
			}
		}(hk)
	}

	if len(registered) == 0 {
		return
	}

	a.restoreHotkey = registered
}

func (a *App) unregisterRestoreHotkey() {
	a.hotkeyMu.Lock()
	defer a.hotkeyMu.Unlock()
	a.unregisterRestoreHotkeyLocked()
}

func (a *App) unregisterRestoreHotkeyLocked() {
	if len(a.restoreHotkey) == 0 {
		return
	}

	for _, hk := range a.restoreHotkey {
		_ = hk.Unregister()
	}
	a.restoreHotkey = nil
}

// ===================== Worksheet File I/O (Secure Persistence) =====================

// WorksheetExportPayload is the plaintext structure exported to encrypted file
type WorksheetExportPayload struct {
	Content         string                 `json:"content"`
	LastResult      *float64               `json:"lastResult"`
	MarkedLines     []int                  `json:"markedLines"`
	VariableValues  map[string]interface{} `json:"variableValues"`
}

// WorksheetEncryptedFile is the on-disk format (JSON with base64-encoded ciphertext + nonce)
type WorksheetEncryptedFile struct {
	Version    int    `json:"version"`
	Ciphertext string `json:"ciphertext"` // base64-encoded AES-256-GCM ciphertext
	Nonce      string `json:"nonce"`      // base64-encoded nonce (12 bytes)
	KeyID      string `json:"keyId"`      // OS keyring identifier
}

// SaveWorksheetResponse is returned by SaveWorksheetToFile
type SaveWorksheetResponse struct {
	OK       bool   `json:"ok"`
	Error    string `json:"error,omitempty"`
	FilePath string `json:"filePath,omitempty"`
}

// LoadWorksheetResponse is returned by LoadWorksheetFromFile
type LoadWorksheetResponse struct {
	OK     bool   `json:"ok"`
	Error  string `json:"error,omitempty"`
	Payload *WorksheetExportPayload `json:"payload,omitempty"`
}

// GetDefaultWorksheetDirectory returns the default directory for saving worksheets
// (e.g., ~/Documents on all platforms, with platform-specific logic)
func (a *App) GetDefaultWorksheetDirectory() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		// Fallback to current working directory
		wd, _ := os.Getwd()
		return wd
	}

	// Use Documents on all platforms (Windows: %USERPROFILE%\Documents, macOS/Linux: ~/Documents)
	docsDir := filepath.Join(homeDir, "Documents")
	return docsDir
}

// SaveWorksheetToFile encrypts a worksheet and saves it to a file.
// The encryption key is stored in the OS keyring (DPAPI on Windows, Keychain on macOS, libsecret on Linux).
// Format: JSON { version, ciphertext (base64), nonce (base64), keyId }
func (a *App) SaveWorksheetToFile(worksheetJSON string, filePath string) SaveWorksheetResponse {
	// Unmarshal the incoming JSON to WorksheetExportPayload to validate
	var payload WorksheetExportPayload
	if err := json.Unmarshal([]byte(worksheetJSON), &payload); err != nil {
		return SaveWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("invalid worksheet JSON: %v", err),
		}
	}

	// Generate random 32-byte key for AES-256-GCM
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return SaveWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to generate encryption key: %v", err),
		}
	}

	// Create AES-256-GCM cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return SaveWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to create cipher: %v", err),
		}
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return SaveWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to create GCM: %v", err),
		}
	}

	// Generate random 12-byte nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return SaveWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to generate nonce: %v", err),
		}
	}

	// Encrypt the JSON payload
	ciphertext := gcm.Seal(nil, nonce, []byte(worksheetJSON), nil)

	// Generate keyID from file hash (user-friendly identifier)
	keyID := filepath.Base(filePath) // Use filename as keyID for simplicity

	// Store key in OS keyring
	if err := storeOrCreateWorksheetKey(keyID, key); err != nil {
		return SaveWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to store key in OS keyring: %v", err),
		}
	}

	// Create the encrypted file structure
	encFile := WorksheetEncryptedFile{
		Version:    1,
		Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
		Nonce:      base64.StdEncoding.EncodeToString(nonce),
		KeyID:      keyID,
	}

	// Marshal to JSON
	encFileJSON, err := json.MarshalIndent(encFile, "", "  ")
	if err != nil {
		return SaveWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to marshal encrypted file: %v", err),
		}
	}

	// Ensure directory exists
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return SaveWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to create directory: %v", err),
		}
	}

	// Write to file
	if err := os.WriteFile(filePath, encFileJSON, 0600); err != nil {
		return SaveWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to write file: %v", err),
		}
	}

	return SaveWorksheetResponse{
		OK:       true,
		FilePath: filePath,
	}
}

// LoadWorksheetFromFile decrypts and loads a worksheet from file.
// Retrieves the encryption key from OS keyring and decrypts the AES-256-GCM ciphertext.
func (a *App) LoadWorksheetFromFile(filePath string) LoadWorksheetResponse {
	// Read the encrypted file
	encFileJSON, err := os.ReadFile(filePath)
	if err != nil {
		return LoadWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to read file: %v", err),
		}
	}

	// Unmarshal the encrypted file structure
	var encFile WorksheetEncryptedFile
	if err := json.Unmarshal(encFileJSON, &encFile); err != nil {
		return LoadWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("invalid encrypted file format: %v", err),
		}
	}

	// Retrieve key from OS keyring
	key, err := getOrCreateWorksheetKey(encFile.KeyID)
	if err != nil {
		return LoadWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to retrieve key from OS keyring: %v", err),
		}
	}

	// Decode base64 ciphertext and nonce
	ciphertext, err := base64.StdEncoding.DecodeString(encFile.Ciphertext)
	if err != nil {
		return LoadWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to decode ciphertext: %v", err),
		}
	}

	nonce, err := base64.StdEncoding.DecodeString(encFile.Nonce)
	if err != nil {
		return LoadWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to decode nonce: %v", err),
		}
	}

	// Create AES-256-GCM cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return LoadWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to create cipher: %v", err),
		}
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return LoadWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to create GCM: %v", err),
		}
	}

	// Decrypt the JSON payload
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return LoadWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("decryption failed (corrupt file or wrong key): %v", err),
		}
	}

	// Unmarshal the plaintext JSON to WorksheetExportPayload
	var payload WorksheetExportPayload
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		return LoadWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to parse decrypted payload: %v", err),
		}
	}

	return LoadWorksheetResponse{
		OK:      true,
		Payload: &payload,
	}
}
