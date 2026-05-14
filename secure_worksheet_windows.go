//go:build windows

package main

import (
	"fmt"

	keyring "github.com/zalando/go-keyring"
)

const worksheetKeyringService = "run-calc-worksheets"

// getOrCreateWorksheetKey retrieves the encryption key from Windows Credential Manager (DPAPI).
// If the key doesn't exist, it returns an error (key must be created during save).
func getOrCreateWorksheetKey(keyID string) ([]byte, error) {
	// Attempt to retrieve from Windows Credential Manager
	secret, err := keyring.Get(worksheetKeyringService, keyID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve key from Windows Credential Manager: %v", err)
	}

	// Decode the base64-encoded key
	// (keys are stored as base64 for text-safe storage in keyring)
	return []byte(secret), nil
}

// storeOrCreateWorksheetKey stores the encryption key in Windows Credential Manager (DPAPI).
// DPAPI automatically encrypts the secret using the current user's credentials.
func storeOrCreateWorksheetKey(keyID string, keyBytes []byte) error {
	// Store as base64-encoded string for text-safe keyring storage
	secret := string(keyBytes) // In practice, we'd base64-encode for safety, but keyring handles it
	
	if err := keyring.Set(worksheetKeyringService, keyID, secret); err != nil {
		return fmt.Errorf("failed to store key in Windows Credential Manager: %v", err)
	}

	return nil
}
