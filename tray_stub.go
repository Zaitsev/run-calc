//go:build !windows

package main

import (
	_ "embed"
	"runtime"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed build/appicon.png
var darwinTrayIcon []byte

var (
	darwinTrayMu  sync.Mutex
	darwinSystray *application.SystemTray
)

func (a *App) startTray() {
	if runtime.GOOS != "darwin" || a.app == nil {
		return
	}

	darwinTrayMu.Lock()
	defer darwinTrayMu.Unlock()
	if darwinSystray != nil {
		return
	}

	systray := a.app.SystemTray.New()
	if len(darwinTrayIcon) > 0 {
		systray.SetIcon(darwinTrayIcon)
	}
	systray.SetTooltip("Run-Calc")

	menu := application.NewMenu()
	menu.Add("Show Run-Calc").OnClick(func(_ *application.Context) {
		a.ShowWindow()
	})
	menu.AddSeparator()
	menu.Add("Quit (your work is saved)").OnClick(func(_ *application.Context) {
		a.quit()
	})
	systray.SetMenu(menu)

	darwinSystray = systray
}

func (a *App) stopTray() {
	darwinTrayMu.Lock()
	systray := darwinSystray
	darwinSystray = nil
	darwinTrayMu.Unlock()

	if systray != nil {
		systray.Destroy()
	}
}

func setProcessPriorityBackground() {
}

func setProcessPriorityNormal() {
}

func (a *App) applyNativeWindowTheme(mode string) {
}
