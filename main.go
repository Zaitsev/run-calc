package main

import (
	"embed"
	goruntime "runtime"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

func applicationMenu(app *App) *application.Menu {
	appMenu := application.NewMenu()

	if goruntime.GOOS == "darwin" {
		appMenu.AddRole(application.AppMenu)
	}

	fileMenu := appMenu.AddSubmenu("File")
	fileMenu.Add("New").SetAccelerator("CmdOrCtrl+n").OnClick(func(_ *application.Context) {
		app.clearWorksheet()
	})
	fileMenu.AddSeparator()
	fileMenu.Add("Quit (your work is saved)").SetAccelerator("CmdOrCtrl+q").OnClick(func(_ *application.Context) {
		app.quit()
	})

	viewMenu := appMenu.AddSubmenu("View")
	viewMenu.Add("Reload").SetAccelerator("CmdOrCtrl+r").OnClick(func(_ *application.Context) {
		app.reloadWindow()
	})
	viewMenu.Add("Increase Font Size").SetAccelerator("CmdOrCtrl+=").OnClick(func(_ *application.Context) {
		app.increaseFontSize()
	})
	viewMenu.Add("Decrease Font Size").SetAccelerator("CmdOrCtrl+-").OnClick(func(_ *application.Context) {
		app.decreaseFontSize()
	})
	viewMenu.Add("Reset Font Size").SetAccelerator("CmdOrCtrl+0").OnClick(func(_ *application.Context) {
		app.resetFontSize()
	})
	viewMenu.Add("Reset Window Layout").OnClick(func(_ *application.Context) {
		app.resetWindowLayout()
	})

	helpMenu := appMenu.AddSubmenu("Help")
	helpMenu.Add("Calculator Help").OnClick(func(_ *application.Context) {
		app.openHelp()
	})
	helpMenu.AddSeparator()
	helpMenu.Add("About Run-Calc").OnClick(func(_ *application.Context) {
		app.showAbout()
	})

	if goruntime.GOOS == "darwin" {
		appMenu.AddRole(application.EditMenu)
	}

	return appMenu
}

func main() {
	app := NewApp()

	wailsApp := application.New(application.Options{
		Name:        "Run-Calc",
		Description: "Run-Calc notepad-style calculator",
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
		Services: []application.Service{
			application.NewService(app),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID:               "19878879-f3de-4597-8575-567d72f4f74a",
			OnSecondInstanceLaunch: app.onSecondInstanceLaunch,
		},
	})

	app.init(wailsApp)

	if goruntime.GOOS == "darwin" {
		wailsApp.Menu.SetApplicationMenu(applicationMenu(app))
		wailsApp.Event.OnApplicationEvent(events.Mac.ApplicationShouldHandleReopen, func(_ *application.ApplicationEvent) {
			app.ShowWindow()
		})
	}

	mainWindow := wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "Run-Calc",
		Width:            1100,
		Height:           760,
		MinWidth:         240,
		MinHeight:        120,
		Frameless:        false,
		BackgroundColour: application.NewRGBA(27, 38, 54, 255),
		Windows: application.WindowsWindow{
			Theme:        application.SystemDefault,
			BackdropType: application.Mica,
		},
	})

	mainWindow.RegisterHook(events.Common.WindowClosing, func(event *application.WindowEvent) {
		if app.beforeClose() {
			event.Cancel()
		}
	})

	app.mainWindow = mainWindow

	err := wailsApp.Run()
	if err != nil {
		println("Error:", err.Error())
	}
}
