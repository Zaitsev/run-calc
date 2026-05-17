//go:build linux

package main

import (
	"encoding/base64"
	"fmt"

	keyring "github.com/zalando/go-keyring"
)

const worksheetKeyringService = "run-calc-worksheets"

// getOrCreateWorksheetKey retrieves the encryption key from Linux Secret Service.
// If secure storage is unavailable, loading fails with a clear error instead of falling back to disk.
func getOrCreateWorksheetKey(keyID string) ([]byte, error) {
	secret, err := keyring.Get(worksheetKeyringService, keyID)
	if err != nil {
		return nil, fmt.Errorf("Linux Secret Service is unavailable or the worksheet key was not found: %w", err)
	}

	keyBytes, decodeErr := base64.StdEncoding.DecodeString(secret)
	if decodeErr != nil {
		return nil, fmt.Errorf("failed to decode key from Linux Secret Service: %w", decodeErr)
	}

	return keyBytes, nil
}

// storeOrCreateWorksheetKey stores the encryption key in Linux Secret Service.
// If secure storage is unavailable, saving fails with a clear error instead of writing key material to disk.
func storeOrCreateWorksheetKey(keyID string, keyBytes []byte) error {
	secret := base64.StdEncoding.EncodeToString(keyBytes)
	if err := keyring.Set(worksheetKeyringService, keyID, secret); err != nil {
		return fmt.Errorf("failed to store worksheet key in Linux Secret Service: %w", err)
	}
	return nil
}
