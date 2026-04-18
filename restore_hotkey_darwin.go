//go:build darwin

package main

import "golang.design/x/hotkey"

type restoreHotkeySpec struct {
	mods []hotkey.Modifier
	key  hotkey.Key
}

func restoreHotkeySpecs() []restoreHotkeySpec {
	// macOS keypad Clear key is the closest NumLock-equivalent.
	return []restoreHotkeySpec{{mods: []hotkey.Modifier{hotkey.ModCmd}, key: hotkey.Key(0x47)}}
}
