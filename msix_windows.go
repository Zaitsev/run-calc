//go:build windows

package main

import (
	"sync"
	"syscall"
	"unsafe"
)

var (
	msixOnce   sync.Once
	msixResult bool

	modKernel32                     = syscall.NewLazyDLL("kernel32.dll")
	procGetCurrentPackageFamilyName = modKernel32.NewProc("GetCurrentPackageFamilyName")
)

// isRunningAsMSIX reports whether the current process has an MSIX package
// identity (e.g. installed from the Windows Store). The result is cached after
// the first call.
//
// When true, RegisterHotKey is blocked by the AppContainer sandbox, so
// global hotkey registration must be skipped.
func isRunningAsMSIX() bool {
	msixOnce.Do(func() {
		var length uint32
		ret, _, _ := procGetCurrentPackageFamilyName.Call(
			uintptr(unsafe.Pointer(&length)),
			0, // null name buffer — we only need the error code
		)
		// APPMODEL_ERROR_NO_PACKAGE (15700): process has no package identity.
		// Any other code (typically ERROR_INSUFFICIENT_BUFFER = 122) means a
		// package family name was found — we are running inside an MSIX package.
		const appmodelErrorNoPackage = 15700
		msixResult = uint32(ret) != appmodelErrorNoPackage
	})
	return msixResult
}
