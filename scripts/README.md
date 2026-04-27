# Scripts

All scripts can be run from the repo root or from any directory — they resolve paths relative to their own location.

---

## ci-verify.ps1

Runs the same checks as CI locally. Use this before pushing to catch failures early.

```powershell
.\scripts\ci-verify.ps1
```

Steps performed: Go tests → frontend `npm install` → frontend build → frontend tests → `wails build -clean`.

---

## dev-wails.ps1

Starts the Wails dev server on a random free port in a configurable range (avoids conflicts when multiple dev sessions run on the same machine).

```powershell
.\scripts\dev-wails.ps1
.\scripts\dev-wails.ps1 -StartPort 34115 -EndPort 35999
# Pass extra flags through to wails dev:
.\scripts\dev-wails.ps1 -- -tags dev
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `-StartPort` | `34115` | Low end of port search range |
| `-EndPort` | `35999` | High end of port search range |
| remaining args | — | Forwarded verbatim to `wails dev` |

---

## New-MsixDevCert.ps1  *(one-time setup per machine)*

> Required to test sideloaded MSIX packages locally, but not needed for Store submission.

Creates a self-signed code-signing certificate whose Subject matches the `Publisher` field in `build\windows\AppxManifest.xml`, then exports it to a PFX file. If a valid cert with the same Subject already exists in `Cert:\CurrentUser\My` it is reused rather than creating a duplicate.

```powershell
# Basic — creates build\certs\Run-Calc-Dev.pfx with no password
.\scripts\New-MsixDevCert.ps1

# With a password and trust import (required for sideload installation)
.\scripts\New-MsixDevCert.ps1 -Password "MyPass" -Trust

# Custom output path
.\scripts\New-MsixDevCert.ps1 -OutPfx .\my-certs\dev.pfx -Password "MyPass" -Trust
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `-Password` | `""` | PFX password (empty = no password) |
| `-OutPfx` | `build\certs\Run-Calc-Dev.pfx` | Where to write the PFX |
| `-Subject` | read from `AppxManifest.xml` | Override cert Subject (`CN=...`) |
| `-Trust` | off | Import public cert into `CurrentUser\TrustedPeople` + `Root` so Windows accepts sideloaded packages |

> **Security**: `build\certs\*.pfx` is in `.gitignore`. Never commit the PFX — it contains the private key.

---

## pack-msix.ps1

Builds and packages the app as an MSIX. Optionally signs it with a PFX for local test installation.

```powershell
# Full build + pack (no signing)
.\scripts\pack-msix.ps1

# Skip wails build (use existing build\bin\Run-Calc.exe)
.\scripts\pack-msix.ps1 -SkipBuild

# Pack + sign for local sideload testing
.\scripts\pack-msix.ps1 -SkipBuild -SelfSign -PfxPath .\build\certs\Run-Calc-Dev.pfx -PfxPassword "MyPass"

# Specify a version quad (required for CI/release)
.\scripts\pack-msix.ps1 -Version 1.2.3.0 -SkipBuild -SelfSign -PfxPath .\build\certs\Run-Calc-Dev.pfx -PfxPassword "MyPass"
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `-Version` | `0.5.1.0` | Four-part version written into `AppxManifest.xml` |
| `-SkipBuild` | off | Skip `wails build -clean`; use existing executable |
| `-SelfSign` | off | Sign the MSIX after packing |
| `-PfxPath` | — | Path to PFX file (create with `New-MsixDevCert.ps1`) |
| `-PfxPassword` | — | PFX password |
| `-CertSubject` | read from manifest | Override cert Subject for store lookup (only used when `-PfxPath` is omitted) |

Output: `build\bin\Run-Calc-<Version>-windows.msix`

**Typical local test workflow:**
```powershell
# 1. One-time cert setup
.\scripts\New-MsixDevCert.ps1 -Password "MyPass" -Trust

# 2. Build and sign
.\scripts\pack-msix.ps1 -SelfSign -PfxPath .\build\certs\Run-Calc-Dev.pfx -PfxPassword "MyPass"

# 3. Install
Add-AppxPackage .\build\bin\Run-Calc-0.5.1.0-windows.msix
```

---

## package-linux-appimage.sh  *(Linux only)*

Packages the already-built Linux binary as an AppImage. Requires `appimagetool` to be available (downloaded automatically into `build/appimage/tools/` if missing).

```bash
# Defaults: APP_NAME=Run-Calc  VERSION=dev  ARCH=x86_64
./scripts/package-linux-appimage.sh

# Override via environment
APP_NAME=Run-Calc VERSION=1.2.3 ARCH=x86_64 ./scripts/package-linux-appimage.sh
```

Output: `release/Run-Calc-<VERSION>-x86_64.AppImage`
