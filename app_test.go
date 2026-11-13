package main

import (
	"runtime"
	"testing"
)

func TestBeforeClose_DoesNotMinimizeOutsideWindows(t *testing.T) {
	if runtime.GOOS == "windows" || runtime.GOOS == "darwin" {
		t.Skip("unsupported tray-on-close platform test")
	}

	app := NewApp()
	app.minimiseToTrayOnClose.Store(true)

	cancelClose := app.beforeClose()
	if cancelClose {
		t.Fatal("expected close to continue on unsupported OS")
	}
}

func TestBeforeClose_MinimizesWhenEnabledOnSupportedOS(t *testing.T) {
	if runtime.GOOS != "windows" && runtime.GOOS != "darwin" {
		t.Skip("tray-on-close supported OS test")
	}
	t.Cleanup(setProcessPriorityNormal)

	app := NewApp()
	app.minimiseToTrayOnClose.Store(true)

	if !app.beforeClose() {
		t.Fatal("expected close to be cancelled and hidden to tray when minimiseToTrayOnClose is true")
	}

	app.minimiseToTrayOnClose.Store(false)
	if app.beforeClose() {
		t.Fatal("expected close to continue when minimiseToTrayOnClose is false")
	}
}

func TestBeforeClose_AllowsSingleQuitClose(t *testing.T) {
	app := NewApp()
	app.allowCloseOnce.Store(true)
	app.minimiseToTrayOnClose.Store(true)

	cancelClose := app.beforeClose()
	if cancelClose {
		t.Fatal("expected close to continue when allowCloseOnce is set")
	}
	if app.allowCloseOnce.Load() {
		t.Fatal("expected allowCloseOnce to be reset after beforeClose")
	}
}
