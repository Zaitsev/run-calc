//go:build windows

package main

import (
	"encoding/base64"
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

	keyBytes, err := base64.StdEncoding.DecodeString(secret)
	if err != nil {
		return nil, fmt.Errorf("failed to decode key from Windows Credential Manager: %v", err)
	}

	return keyBytes, nil
}

// storeOrCreateWorksheetKey stores the encryption key in Windows Credential Manager (DPAPI).
// DPAPI automatically encrypts the secret using the current user's credentials.
func storeOrCreateWorksheetKey(keyID string, keyBytes []byte) error {
	secret := base64.StdEncoding.EncodeToString(keyBytes)

	if err := keyring.Set(worksheetKeyringService, keyID, secret); err != nil {
		return fmt.Errorf("failed to store key in Windows Credential Manager: %v", err)
	}

	return nil
}
