package main

import (
	"context"
	"runtime"
	"testing"
)

func TestBeforeClose_DoesNotMinimiseOutsideWindows(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("non-Windows behavior test")
	}

	app := NewApp()
	app.minimiseToTrayOnClose.Store(true)

	cancelClose := app.beforeClose(context.Background())
	if cancelClose {
		t.Fatal("expected close to continue on non-Windows")
	}
}

func TestBeforeClose_AllowsSingleQuitClose(t *testing.T) {
	app := NewApp()
	app.allowCloseOnce.Store(true)
	app.minimiseToTrayOnClose.Store(true)

	cancelClose := app.beforeClose(context.Background())
	if cancelClose {
		t.Fatal("expected close to continue when allowCloseOnce is set")
	}
	if app.allowCloseOnce.Load() {
		t.Fatal("expected allowCloseOnce to be reset after beforeClose")
	}
}
