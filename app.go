package main

import (
	"context"
	"fmt"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
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
		Title:   "About Calc",
		Message: "Calc is a native Wails desktop calculator with a system menu and standard OS window chrome.",
	})
}

func (a *App) quit() {
	wruntime.Quit(a.ctx)
}
