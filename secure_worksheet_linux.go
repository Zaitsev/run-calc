//go:build linux

package main

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"strings"

	keyring "github.com/zalando/go-keyring"
)

const worksheetKeyringService = "run-calc-worksheets"

// getOrCreateWorksheetKey retrieves the encryption key from Linux libsecret (Secret Service).
// If unavailable (e.g., headless environment), attempts to derive key from passphrase file.
// Returns error if neither method is available.
func getOrCreateWorksheetKey(keyID string) ([]byte, error) {
	// Try libsecret first (Secret Service backend)
	secret, err := keyring.Get(worksheetKeyringService, keyID)
	if err == nil {
		return []byte(secret), nil
	}

	// Fallback: Try to derive from passphrase file stored in config directory
	passphraseKey, err := deriveWorksheetKeyFromPassphrase(keyID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve key from libsecret and passphrase fallback unavailable: %v", err)
	}

	return passphraseKey, nil
}

// storeOrCreateWorksheetKey stores the encryption key in libsecret (Secret Service).
// If Secret Service is unavailable, falls back to PBKDF2-derived passphrase storage.
func storeOrCreateWorksheetKey(keyID string, keyBytes []byte) error {
	secret := string(keyBytes)

	// Try to store in libsecret first
	err := keyring.Set(worksheetKeyringService, keyID, secret)
	if err == nil {
		return nil
	}

	// Fallback: Store a passphrase-derived key
	// In practice, user would be prompted for a passphrase, but for now we generate a synthetic one
	if err := storeWorksheetKeyPassphrase(keyID, keyBytes); err != nil {
		return fmt.Errorf("failed to store key in libsecret and passphrase fallback also failed: %v", err)
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

// deriveWorksheetKeyFromPassphrase derives the encryption key from a stored passphrase using PBKDF2.
// This is a fallback for headless environments where Secret Service is unavailable.
func deriveWorksheetKeyFromPassphrase(keyID string) ([]byte, error) {
	configDir, err := worksheetConfigDir()
	if err != nil {
		return nil, err
	}

	passphraseFile := configDir + "/" + keyID + ".passphrase"
	content, err := os.ReadFile(passphraseFile)
	if err != nil {
		return nil, fmt.Errorf("passphrase file not found: %v", err)
	}

	lines := strings.Split(string(content), "\n")
	if len(lines) < 2 {
		return nil, fmt.Errorf("passphrase file format invalid")
	}

	passphrase := strings.TrimSpace(lines[0])
	salt := strings.TrimSpace(lines[1])

	// Decode salt from hex
	saltBytes, err := hex.DecodeString(salt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode salt: %v", err)
	}

	// Derive key using PBKDF2 (100,000 iterations, SHA-256)
	key, err := pbkdf2.Key([]byte(passphrase), saltBytes, 100000, 32, sha256.New)
	if err != nil {
		return nil, fmt.Errorf("failed to derive key from passphrase: %v", err)
	}
	return key, nil
}

// storeWorksheetKeyPassphrase stores a key by deriving it from a synthetic passphrase.
// In production, user would be prompted for passphrase; here we use a deterministic generation.
func storeWorksheetKeyPassphrase(keyID string, keyBytes []byte) error {
	configDir, err := worksheetConfigDir()
	if err != nil {
		return err
	}

	// Ensure directory exists
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return err
	}

	// Generate random salt (16 bytes)
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return fmt.Errorf("failed to generate salt: %v", err)
	}

	// For now, use a deterministic passphrase derived from the key itself
	// In production, this would be user-provided
	synthesizedPassphrase := hex.EncodeToString(keyBytes[:16])

	// Verify we can derive the same key back
	derivedKey, err := pbkdf2.Key([]byte(synthesizedPassphrase), salt, 100000, 32, sha256.New)
	if err != nil {
		return fmt.Errorf("failed to derive verification key: %v", err)
	}
	if string(derivedKey) != string(keyBytes) {
		return fmt.Errorf("passphrase derivation mismatch (should derive to same key)")
	}

	// Write passphrase and salt to file
	passphraseFile := configDir + "/" + keyID + ".passphrase"
	content := synthesizedPassphrase + "\n" + hex.EncodeToString(salt)
	if err := os.WriteFile(passphraseFile, []byte(content), 0600); err != nil {
		return fmt.Errorf("failed to write passphrase file: %v", err)
	}

	return nil
}
