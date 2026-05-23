//go:build windows

package main

import (
	"crypto/md5"
	_ "embed"
	"encoding/hex"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"syscall"
	"unsafe"

	"github.com/lxn/win"
)

//go:embed build/windows/icon.ico
var trayIcon []byte

var (
	trayStartOnce sync.Once
	trayStopOnce  sync.Once

	trayAppMu sync.RWMutex
	trayApp   *App

	trayWindowMu sync.RWMutex
	trayWindow   win.HWND
)

const (
	trayCallbackMessage = win.WM_APP + 42
	trayMenuCmdShow     = 1001
	trayMenuCmdQuit     = 1002

	// Windows process power throttling constants for Efficiency Mode
	PROCESS_POWER_THROTTLING_EXECUTION_SPEED         = 0x1
	PROCESS_POWER_THROTTLING_IGNORE_TIMER_RESOLUTION = 0x4
	ProcessPowerThrottlingInformationClass           = 4

	// Process enumeration constants
	TH32CS_SNAPPROCESS            = 0x00000002
	PROCESS_SET_INFORMATION       = 0x0200
	PROCESS_QUERY_LIMITED_INFO    = 0x1000
	PROCESS_MODE_BACKGROUND_BEGIN = 0x00100000
	PROCESS_MODE_BACKGROUND_END   = 0x00200000
)

type PROCESS_POWER_THROTTLING_STATE struct {
	Version     uint32
	ControlMask uint32
	StateMask   uint32
}

type PROCESSENTRY32 struct {
	DwSize              uint32
	CntUsage            uint32
	Th32ProcessID       uint32
	Th32DefaultHeapID   uintptr
	Th32ModuleID        uint32
	CntThreads          uint32
	Th32ParentProcessID uint32
	PcPriClassBase      int32
	DwFlags             uint32
	SzExeFile           [260]uint16
}

var (
	kernel32                  = syscall.NewLazyDLL("kernel32.dll")
	procSetProcessInformation = kernel32.NewProc("SetProcessInformation")
	procSetPriorityClass      = kernel32.NewProc("SetPriorityClass")
	procCreateToolhelp32Snapshot = kernel32.NewProc("CreateToolhelp32Snapshot")
	procProcess32First        = kernel32.NewProc("Process32FirstW")
	procProcess32Next         = kernel32.NewProc("Process32NextW")
	procOpenProcess           = kernel32.NewProc("OpenProcess")
)

func (a *App) startTray() {
	trayAppMu.Lock()
	trayApp = a
	trayAppMu.Unlock()

	trayStartOnce.Do(func() {
		go runWindowsTrayLoop()
	})
}

func (a *App) stopTray() {
	trayStopOnce.Do(func() {
		trayWindowMu.RLock()
		hwnd := trayWindow
		trayWindowMu.RUnlock()
		if hwnd != 0 {
			win.PostMessage(hwnd, win.WM_CLOSE, 0, 0)
		}
	})
}

func runWindowsTrayLoop() {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	className, _ := syscall.UTF16PtrFromString("RunCalcTrayClass")
	hInstance := win.GetModuleHandle(nil)

	wc := win.WNDCLASSEX{
		CbSize:        uint32(unsafe.Sizeof(win.WNDCLASSEX{})),
		LpfnWndProc:   syscall.NewCallback(trayWndProc),
		HInstance:     hInstance,
		LpszClassName: className,
		HCursor:       win.LoadCursor(0, win.MAKEINTRESOURCE(win.IDC_ARROW)),
	}
	if win.RegisterClassEx(&wc) == 0 {
		return
	}

	hwnd := win.CreateWindowEx(
		0,
		className,
		className,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		hInstance,
		nil,
	)
	if hwnd == 0 {
		return
	}

	trayWindowMu.Lock()
	trayWindow = hwnd
	trayWindowMu.Unlock()

	iconHandle := loadTrayIconHandle()
	nid := win.NOTIFYICONDATA{
		CbSize:           uint32(unsafe.Sizeof(win.NOTIFYICONDATA{})),
		HWnd:             hwnd,
		UID:              1,
		UFlags:           win.NIF_MESSAGE | win.NIF_ICON | win.NIF_TIP,
		UCallbackMessage: trayCallbackMessage,
		HIcon:            iconHandle,
	}
	copy(nid.SzTip[:], syscall.StringToUTF16("Run-Calc"))
	if !win.Shell_NotifyIcon(win.NIM_ADD, &nid) {
		if iconHandle != 0 {
			win.DestroyIcon(iconHandle)
		}
		return
	}

	var msg win.MSG
	for {
		result := win.GetMessage(&msg, 0, 0, 0)
		if result <= 0 {
			break
		}
		win.TranslateMessage(&msg)
		win.DispatchMessage(&msg)
	}

	win.Shell_NotifyIcon(win.NIM_DELETE, &nid)
	if iconHandle != 0 {
		win.DestroyIcon(iconHandle)
	}

	trayWindowMu.Lock()
	trayWindow = 0
	trayWindowMu.Unlock()
}

func trayWndProc(hwnd win.HWND, msg uint32, wParam, lParam uintptr) uintptr {
	switch msg {
	case trayCallbackMessage:
		switch lParam {
		case win.WM_LBUTTONUP:
			restoreFromTray()
			return 0
		case win.WM_RBUTTONUP:
			showTrayMenu(hwnd)
			return 0
		}
	case win.WM_COMMAND:
		switch uint16(win.LOWORD(uint32(wParam))) {
		case trayMenuCmdShow:
			restoreFromTray()
			return 0
		case trayMenuCmdQuit:
			trayAppMu.RLock()
			currentApp := trayApp
			trayAppMu.RUnlock()
			if currentApp != nil {
				currentApp.quit()
			}
			return 0
		}
	case win.WM_CLOSE:
		win.DestroyWindow(hwnd)
		return 0
	case win.WM_DESTROY:
		win.PostQuitMessage(0)
		return 0
	}

	return win.DefWindowProc(hwnd, msg, wParam, lParam)
}

func restoreFromTray() {
	trayAppMu.RLock()
	currentApp := trayApp
	trayAppMu.RUnlock()
	if currentApp != nil {
		currentApp.ShowWindow()
	}
}

func showTrayMenu(hwnd win.HWND) {
	menu := win.CreatePopupMenu()
	if menu == 0 {
		return
	}
	defer win.DestroyMenu(menu)

	showText, _ := syscall.UTF16PtrFromString("Show Run-Calc")
	quitText, _ := syscall.UTF16PtrFromString("Quit (your work is saved)")

	showItem := win.MENUITEMINFO{
		CbSize:     uint32(unsafe.Sizeof(win.MENUITEMINFO{})),
		FMask:      win.MIIM_ID | win.MIIM_STRING | win.MIIM_STATE,
		WID:        trayMenuCmdShow,
		DwTypeData: showText,
		FState:     win.MFS_ENABLED,
	}
	separator := win.MENUITEMINFO{
		CbSize: uint32(unsafe.Sizeof(win.MENUITEMINFO{})),
		FMask:  win.MIIM_FTYPE,
		FType:  win.MFT_SEPARATOR,
	}
	quitItem := win.MENUITEMINFO{
		CbSize:     uint32(unsafe.Sizeof(win.MENUITEMINFO{})),
		FMask:      win.MIIM_ID | win.MIIM_STRING | win.MIIM_STATE,
		WID:        trayMenuCmdQuit,
		DwTypeData: quitText,
		FState:     win.MFS_ENABLED,
	}

	win.InsertMenuItem(menu, 0, true, &showItem)
	win.InsertMenuItem(menu, 1, true, &separator)
	win.InsertMenuItem(menu, 2, true, &quitItem)

	var pt win.POINT
	win.GetCursorPos(&pt)
	win.SetForegroundWindow(hwnd)
	selected := win.TrackPopupMenu(
		menu,
		win.TPM_RETURNCMD|win.TPM_NONOTIFY|win.TPM_RIGHTBUTTON,
		pt.X,
		pt.Y,
		0,
		hwnd,
		nil,
	)
	if selected != 0 {
		win.PostMessage(hwnd, win.WM_COMMAND, uintptr(selected), 0)
	}
}

func loadTrayIconHandle() win.HICON {
	if len(trayIcon) == 0 {
		return 0
	}

	path, err := writeTrayIconTempFile(trayIcon)
	if err != nil {
		return 0
	}

	pathPtr, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return 0
	}

	return win.HICON(win.LoadImage(
		0,
		pathPtr,
		win.IMAGE_ICON,
		0,
		0,
		win.LR_LOADFROMFILE|win.LR_DEFAULTSIZE,
	))
}

func writeTrayIconTempFile(data []byte) (string, error) {
	hash := md5.Sum(data)
	name := "runcalc_tray_" + hex.EncodeToString(hash[:]) + ".ico"
	path := filepath.Join(os.TempDir(), name)
	if _, err := os.Stat(path); err == nil {
		return path, nil
	}

	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", err
	}
	return path, nil
}

func setProcessPriorityBackground() {
	// Enable Windows 11 Efficiency Mode (EcoQoS).
	state := PROCESS_POWER_THROTTLING_STATE{
		Version:     1,
		ControlMask: PROCESS_POWER_THROTTLING_EXECUTION_SPEED | PROCESS_POWER_THROTTLING_IGNORE_TIMER_RESOLUTION,
		StateMask:   PROCESS_POWER_THROTTLING_EXECUTION_SPEED | PROCESS_POWER_THROTTLING_IGNORE_TIMER_RESOLUTION,
	}
	applyEfficiencyModeToProcessTree(state, PROCESS_MODE_BACKGROUND_BEGIN)
}

func setProcessPriorityNormal() {
	// Disable power throttling to restore normal performance.
	state := PROCESS_POWER_THROTTLING_STATE{
		Version:     1,
		ControlMask: PROCESS_POWER_THROTTLING_EXECUTION_SPEED | PROCESS_POWER_THROTTLING_IGNORE_TIMER_RESOLUTION,
		StateMask:   0,
	}
	applyEfficiencyModeToProcessTree(state, PROCESS_MODE_BACKGROUND_END)
}

func applyEfficiencyModeToProcessTree(state PROCESS_POWER_THROTTLING_STATE, priorityClass uintptr) {
	currentPID := uint32(os.Getpid())
	processes, err := snapshotProcesses()
	if err != nil {
		return
	}

	pidQueue := []uint32{currentPID}
	seen := map[uint32]struct{}{currentPID: {}}
	for len(pidQueue) > 0 {
		pid := pidQueue[0]
		pidQueue = pidQueue[1:]
		applyEfficiencyToSingleProcess(pid, state, priorityClass)

		for _, entry := range processes {
			if entry.Th32ParentProcessID != pid {
				continue
			}
			if _, exists := seen[entry.Th32ProcessID]; exists {
				continue
			}
			seen[entry.Th32ProcessID] = struct{}{}
			pidQueue = append(pidQueue, entry.Th32ProcessID)
		}
	}
}

func snapshotProcesses() ([]PROCESSENTRY32, error) {
	currentPID := uint32(os.Getpid())
	_ = currentPID

	snapshot, _, _ := procCreateToolhelp32Snapshot.Call(
		uintptr(TH32CS_SNAPPROCESS),
		0,
	)
	if snapshot == 0 || snapshot == uintptr(syscall.InvalidHandle) {
		return nil, syscall.EINVAL
	}
	defer syscall.CloseHandle(syscall.Handle(snapshot))

	var pe PROCESSENTRY32
	pe.DwSize = uint32(unsafe.Sizeof(pe))

	ret, _, _ := procProcess32First.Call(snapshot, uintptr(unsafe.Pointer(&pe)))
	if ret == 0 {
		return nil, syscall.EINVAL
	}

	processes := make([]PROCESSENTRY32, 0, 64)
	for {
		processes = append(processes, pe)
		ret, _, _ = procProcess32Next.Call(snapshot, uintptr(unsafe.Pointer(&pe)))
		if ret == 0 {
			break
		}
	}

	return processes, nil
}

func applyEfficiencyToSingleProcess(pid uint32, state PROCESS_POWER_THROTTLING_STATE, priorityClass uintptr) {
	hProcess, _, _ := procOpenProcess.Call(
		PROCESS_SET_INFORMATION|PROCESS_QUERY_LIMITED_INFO,
		0,
		uintptr(pid),
	)
	if hProcess == 0 {
		return
	}
	defer syscall.CloseHandle(syscall.Handle(hProcess))

	procSetProcessInformation.Call(
		hProcess,
		uintptr(ProcessPowerThrottlingInformationClass),
		uintptr(unsafe.Pointer(&state)),
		unsafe.Sizeof(state),
	)
	procSetPriorityClass.Call(hProcess, priorityClass)
}
