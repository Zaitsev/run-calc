//go:build !windows

package main

// isRunningAsMSIX always returns false on non-Windows platforms.
func isRunningAsMSIX() bool { return false }
