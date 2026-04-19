package main

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"

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
	a.restoreShortcutOn.Store(true)
	a.startTray()
	a.ensureRestoreHotkeyRegistration()
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

func (a *App) openDocs() {
	wruntime.BrowserOpenURL(a.ctx, "https://wails.io/docs")
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
}

func (a *App) SetMinimiseToTrayOnClose(enabled bool) {
	a.minimiseToTrayOnClose.Store(enabled)
}

func (a *App) SetRestoreShortcutEnabled(enabled bool) {
	a.restoreShortcutOn.Store(enabled)
	a.ensureRestoreHotkeyRegistration()
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
