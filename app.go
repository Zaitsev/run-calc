package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// App struct
type App struct {
	ctx        context.Context
	app        *application.App
	mainWindow *application.WebviewWindow

	minimiseToTrayOnClose atomic.Bool
	allowCloseOnce        atomic.Bool

	themeSearchMu       sync.Mutex
	themeSearchCancel   context.CancelFunc
	themeSearchActiveID uint64
	sleepMonitorCancel  context.CancelFunc
	aiMu                sync.Mutex
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

func (a *App) init(app *application.App) {
	a.app = app
}

// ServiceStartup is called when the service starts
func (a *App) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	a.ctx = ctx
	a.minimiseToTrayOnClose.Store(true)
	a.startTray()
	a.startSleepResumeMonitor()
	setProcessPriorityNormal()
	return nil
}

// ServiceShutdown is called when the application shuts down
func (a *App) ServiceShutdown() error {
	a.stopTray()
	if a.sleepMonitorCancel != nil {
		a.sleepMonitorCancel()
		a.sleepMonitorCancel = nil
	}
	return nil
}

func (a *App) startSleepResumeMonitor() {
	if a.ctx == nil {
		return
	}

	if a.sleepMonitorCancel != nil {
		a.sleepMonitorCancel()
	}

	monitorCtx, cancel := context.WithCancel(a.ctx)
	a.sleepMonitorCancel = cancel

	go func(ctx context.Context) {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		lastTick := time.Now()
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				if now.Sub(lastTick) > 2*time.Minute {
					if a.app != nil {
						a.app.Event.Emit("system:resume", nil)
					}
				}
				lastTick = now
			}
		}
	}(monitorCtx)
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

func (a *App) clearWorksheet() {
	if a.app != nil {
		a.app.Event.Emit("menu:file:new", nil)
	}
}

func (a *App) reloadWindow() {
	if a.mainWindow != nil {
		a.mainWindow.Reload()
	} else if a.app != nil {
		if w := a.app.Window.Current(); w != nil {
			w.Reload()
		}
	}
}

func (a *App) increaseFontSize() {
	if a.app != nil {
		a.app.Event.Emit("menu:view:increase-font-size", nil)
	}
}

func (a *App) decreaseFontSize() {
	if a.app != nil {
		a.app.Event.Emit("menu:view:decrease-font-size", nil)
	}
}

func (a *App) resetWindowLayout() {
	if a.app != nil {
		a.app.Event.Emit("menu:view:reset-window-layout", nil)
	}
}

func (a *App) resetFontSize() {
	if a.app != nil {
		a.app.Event.Emit("menu:view:reset-font-size", nil)
	}
}

func (a *App) showAbout() {
	if a.app != nil {
		a.app.Dialog.Info().
			SetTitle("About Run-Calc").
			SetMessage("Run-Calc is a native Wails desktop calculator with a system menu and standard OS window chrome.").
			Show()
	}
}

func (a *App) openHelp() {
	if a.app != nil {
		a.app.Event.Emit("menu:help:open", nil)
	}
}

func (a *App) quit() {
	a.allowCloseOnce.Store(true)
	if a.app != nil {
		a.app.Quit()
	}
}

func (a *App) beforeClose() bool {
	if a.allowCloseOnce.Load() {
		a.allowCloseOnce.Store(false)
		return false
	}

	if runtime.GOOS != "windows" {
		return false
	}

	if !a.minimiseToTrayOnClose.Load() {
		return false
	}

	if a.app != nil {
		a.app.Event.Emit("window:hidden", nil)
	}
	if a.mainWindow != nil {
		a.mainWindow.Hide()
	} else if a.app != nil {
		if w := a.app.Window.Current(); w != nil {
			w.Hide()
		}
	}
	setProcessPriorityBackground()
	return true
}

func (a *App) ShowWindow() {
	setProcessPriorityNormal()
	if a.mainWindow != nil {
		a.mainWindow.Show()
		a.mainWindow.UnMinimise()
		a.mainWindow.Focus()
	} else if a.app != nil {
		if w := a.app.Window.Current(); w != nil {
			w.Show()
			w.UnMinimise()
			w.Focus()
		}
	}
	if a.app != nil {
		a.app.Event.Emit("window:shown", nil)
	}

	// Toggle always-on-top briefly to reliably bring restored tray windows to front on Windows.
	if runtime.GOOS == "windows" {
		if a.mainWindow != nil {
			a.mainWindow.SetAlwaysOnTop(true)
			go func() {
				time.Sleep(120 * time.Millisecond)
				if a.mainWindow != nil {
					a.mainWindow.SetAlwaysOnTop(false)
				}
			}()
		}
	}
}

func (a *App) onSecondInstanceLaunch(_ application.SecondInstanceData) {
	a.ShowWindow()
}

func (a *App) SetMinimiseToTrayOnClose(enabled bool) {
	a.minimiseToTrayOnClose.Store(enabled)
}


// ===================== Worksheet File I/O (Secure Persistence) =====================

// WorksheetExportPayload is the plaintext structure exported to encrypted file
type WorksheetExportPayload struct {
	Content          string                 `json:"content"`
	LastResult       *float64               `json:"lastResult"`
	MarkedLines      []int                  `json:"markedLines"`
	VariableValues   map[string]interface{} `json:"variableValues"`
	IsLocked         bool                   `json:"isLocked,omitempty"`
	LockPasswordHash string                 `json:"lockPasswordHash,omitempty"`
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
	OK      bool                    `json:"ok"`
	Error   string                  `json:"error,omitempty"`
	Payload *WorksheetExportPayload `json:"payload,omitempty"`
}

func generateWorksheetKeyID() (string, error) {
	keyIDBytes := make([]byte, 16)
	if _, err := rand.Read(keyIDBytes); err != nil {
		return "", err
	}

	return hex.EncodeToString(keyIDBytes), nil
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

// SelectWorksheetEncryptedSavePath opens native OS save dialog for encrypted worksheet files.
// Returns empty string if user cancels or dialog fails.
func (a *App) SelectWorksheetEncryptedSavePath(defaultFileName string) string {
	if a.app == nil {
		return ""
	}

	dialog := a.app.Dialog.SaveFileWithOptions(&application.SaveFileDialogOptions{
		Title:                "Save Worksheet (Encrypted)",
		Directory:            a.GetDefaultWorksheetDirectory(),
		Filename:             defaultFileName,
		CanCreateDirectories: true,
		Filters: []application.FileFilter{
			{DisplayName: "Run-Calc Worksheet (*.rcalc)", Pattern: "*.rcalc"},
		},
	})
	if a.mainWindow != nil {
		dialog.AttachToWindow(a.mainWindow)
	}
	selectedPath, err := dialog.PromptForSingleSelection()
	if err != nil {
		return ""
	}
	return selectedPath
}

// SelectWorksheetPlaintextExportPath opens native OS save dialog for plaintext worksheet exports.
// Returns empty string if user cancels or dialog fails.
func (a *App) SelectWorksheetPlaintextExportPath(defaultFileName string) string {
	if a.app == nil {
		return ""
	}

	dialog := a.app.Dialog.SaveFileWithOptions(&application.SaveFileDialogOptions{
		Title:                "Export Worksheet (Plain Text)",
		Directory:            a.GetDefaultWorksheetDirectory(),
		Filename:             defaultFileName,
		CanCreateDirectories: true,
		Filters: []application.FileFilter{
			{DisplayName: "JSON (*.json)", Pattern: "*.json"},
			{DisplayName: "All Files (*.*)", Pattern: "*.*"},
		},
	})
	if a.mainWindow != nil {
		dialog.AttachToWindow(a.mainWindow)
	}
	selectedPath, err := dialog.PromptForSingleSelection()
	if err != nil {
		return ""
	}
	return selectedPath
}

// SelectWorksheetLoadPath opens native OS open dialog for encrypted worksheet files.
// Returns empty string if user cancels or dialog fails.
func (a *App) SelectWorksheetLoadPath() string {
	if a.app == nil {
		return ""
	}

	dialog := a.app.Dialog.OpenFileWithOptions(&application.OpenFileDialogOptions{
		Title:     "Load Worksheet",
		Directory: a.GetDefaultWorksheetDirectory(),
		Filters: []application.FileFilter{
			{DisplayName: "Run-Calc Worksheet (*.rcalc)", Pattern: "*.rcalc"},
			{DisplayName: "All Files (*.*)", Pattern: "*.*"},
		},
	})
	if a.mainWindow != nil {
		dialog.AttachToWindow(a.mainWindow)
	}
	selectedPath, err := dialog.PromptForSingleSelection()
	if err != nil {
		return ""
	}
	return selectedPath
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

	// Generate a random key identifier that is stored in the encrypted file metadata.
	keyID, err := generateWorksheetKeyID()
	if err != nil {
		return SaveWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to generate encryption key identifier: %v", err),
		}
	}

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

// ExportWorksheetPlaintextToFile saves a worksheet payload as readable plaintext JSON.
// This is intended for explicit export workflows where encryption is not required.
func (a *App) ExportWorksheetPlaintextToFile(worksheetJSON string, filePath string) SaveWorksheetResponse {
	// Validate and normalize payload first
	var payload WorksheetExportPayload
	if err := json.Unmarshal([]byte(worksheetJSON), &payload); err != nil {
		return SaveWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("invalid worksheet JSON: %v", err),
		}
	}

	// Plaintext exports must not include worksheet lock metadata.
	payload.IsLocked = false
	payload.LockPasswordHash = ""

	plaintextJSON, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return SaveWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to marshal plaintext worksheet: %v", err),
		}
	}

	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return SaveWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("failed to create directory: %v", err),
		}
	}

	if err := os.WriteFile(filePath, plaintextJSON, 0600); err != nil {
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

	if encFile.Version != 1 {
		return LoadWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("unsupported worksheet file version: %d", encFile.Version),
		}
	}
	if encFile.KeyID == "" {
		return LoadWorksheetResponse{
			OK:    false,
			Error: "invalid encrypted file format: missing key identifier",
		}
	}
	if encFile.Ciphertext == "" || encFile.Nonce == "" {
		return LoadWorksheetResponse{
			OK:    false,
			Error: "invalid encrypted file format: missing ciphertext or nonce",
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

	if len(nonce) != gcm.NonceSize() {
		return LoadWorksheetResponse{
			OK:    false,
			Error: fmt.Sprintf("invalid encrypted file format: nonce must be %d bytes", gcm.NonceSize()),
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

