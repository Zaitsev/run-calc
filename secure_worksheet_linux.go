//go:build linux

package main

import (
	"encoding/base64"
	"fmt"
	"os"
	"strings"

	keyring "github.com/zalando/go-keyring"
)

const worksheetKeyringService = "run-calc-worksheets"

// getOrCreateWorksheetKey retrieves the encryption key from Linux libsecret (Secret Service).
// If unavailable (e.g., headless environment), it falls back to a file with strict permissions.
func getOrCreateWorksheetKey(keyID string) ([]byte, error) {
	// Try libsecret first (Secret Service backend)
	secret, err := keyring.Get(worksheetKeyringService, keyID)
	if err == nil {
		keyBytes, decodeErr := base64.StdEncoding.DecodeString(secret)
		if decodeErr == nil {
			return keyBytes, nil
		}
		return nil, fmt.Errorf("failed to decode key from libsecret: %v", decodeErr)
	}

	// Fallback: Try to load from file stored in config directory
	fileKey, err := loadWorksheetKeyFromFile(keyID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve key from libsecret and file fallback unavailable: %v", err)
	}

	return fileKey, nil
}

// storeOrCreateWorksheetKey stores the encryption key in libsecret (Secret Service).
// If Secret Service is unavailable, it falls back to a file with strict permissions.
func storeOrCreateWorksheetKey(keyID string, keyBytes []byte) error {
	secret := base64.StdEncoding.EncodeToString(keyBytes)

	// Try to store in libsecret first
	err := keyring.Set(worksheetKeyringService, keyID, secret)
	if err == nil {
		return nil
	}

	// Fallback: Store the actual key bytes in a file with strict permissions.
	if err := storeWorksheetKeyFile(keyID, keyBytes); err != nil {
		return fmt.Errorf("failed to store key in libsecret and file fallback also failed: %v", err)
	}

	return nil
}

// worksheetConfigDir returns the directory for worksheet configuration files
func worksheetConfigDir() (string, error) {
	configDir := os.Getenv("XDG_CONFIG_HOME")
	if configDir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		configDir = home + "/.config"
	}
	worksheetDir := configDir + "/run-calc/worksheets"
	return worksheetDir, nil
}

// loadWorksheetKeyFromFile reads the stored base64-encoded key from a file fallback.
func loadWorksheetKeyFromFile(keyID string) ([]byte, error) {
	configDir, err := worksheetConfigDir()
	if err != nil {
		return nil, err
	}

	keyFile := configDir + "/" + keyID + ".key"
	content, err := os.ReadFile(keyFile)
	if err != nil {
		return nil, fmt.Errorf("key file not found: %v", err)
	}

	keyBytes, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(content)))
	if err != nil {
		return nil, fmt.Errorf("failed to decode key file: %v", err)
	}

	return keyBytes, nil
}

// storeWorksheetKeyFile writes the base64-encoded key to a file fallback with strict permissions.
func storeWorksheetKeyFile(keyID string, keyBytes []byte) error {
	configDir, err := worksheetConfigDir()
	if err != nil {
		return err
	}

	// Ensure directory exists
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return err
	}

	keyFile := configDir + "/" + keyID + ".key"
	content := base64.StdEncoding.EncodeToString(keyBytes)
	if err := os.WriteFile(keyFile, []byte(content), 0600); err != nil {
		return fmt.Errorf("failed to write key file: %v", err)
	}

	return nil
}
