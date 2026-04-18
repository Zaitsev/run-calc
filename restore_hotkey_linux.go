//go:build linux

package main

import "golang.design/x/hotkey"

type restoreHotkeySpec struct {
	mods []hotkey.Modifier
	key  hotkey.Key
}

func restoreHotkeySpecs() []restoreHotkeySpec {
	// X11 keysym for Num_Lock.
	return []restoreHotkeySpec{{mods: []hotkey.Modifier{hotkey.ModCtrl}, key: hotkey.Key(0xff7f)}}
}
