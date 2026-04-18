package main

import (
	"embed"
	goruntime "runtime"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func applicationMenu(app *App) *menu.Menu {
	appMenu := menu.NewMenu()

	if goruntime.GOOS == "darwin" {
		appMenu.Append(menu.AppMenu())
	}

	fileMenu := appMenu.AddSubmenu("File")
	fileMenu.AddText("New", keys.CmdOrCtrl("n"), func(_ *menu.CallbackData) {
		app.clearWorksheet()
	})
	fileMenu.AddSeparator()
	fileMenu.AddText("Quit", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
		app.quit()
	})

	viewMenu := appMenu.AddSubmenu("View")
	viewMenu.AddText("Reload", keys.CmdOrCtrl("r"), func(_ *menu.CallbackData) {
		app.reloadWindow()
	})
	viewMenu.AddText("Increase Font Size", keys.CmdOrCtrl("="), func(_ *menu.CallbackData) {
		app.increaseFontSize()
	})
	viewMenu.AddText("Decrease Font Size", keys.CmdOrCtrl("-"), func(_ *menu.CallbackData) {
		app.decreaseFontSize()
	})
	viewMenu.AddText("Reset Font Size", keys.CmdOrCtrl("0"), func(_ *menu.CallbackData) {
		app.resetFontSize()
	})
	viewMenu.AddText("Reset Window Layout", nil, func(_ *menu.CallbackData) {
		app.resetWindowLayout()
	})

	helpMenu := appMenu.AddSubmenu("Help")
	helpMenu.AddText("About Run-Calc", nil, func(_ *menu.CallbackData) {
		app.showAbout()
	})
	helpMenu.AddText("Wails Docs", nil, func(_ *menu.CallbackData) {
		app.openDocs()
	})

	if goruntime.GOOS == "darwin" {
		appMenu.Append(menu.EditMenu())
	}

	return appMenu
}

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:     "Run-Calc",
		Width:     1100,
		Height:    760,
		MinWidth:  480,
		MinHeight: 320,
		Frameless: false,
		Menu:      applicationMenu(app),
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		Windows: &windows.Options{
			Theme:                             windows.SystemDefault,
			BackdropType:                      windows.Mica,
		},
		OnStartup: app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
