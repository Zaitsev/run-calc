//go:build windows

package main

import "golang.design/x/hotkey"

type restoreHotkeySpec struct {
	mods []hotkey.Modifier
	key  hotkey.Key
}

func restoreHotkeySpecs() []restoreHotkeySpec {
	return []restoreHotkeySpec{
		// Windows virtual key for NumLock.
		{mods: []hotkey.Modifier{hotkey.ModCtrl}, key: hotkey.Key(0x90)},
		// Ctrl+NumLock is often interpreted by Windows as Pause/Break.
		{mods: []hotkey.Modifier{hotkey.ModCtrl}, key: hotkey.Key(0x13)},
	}
}
