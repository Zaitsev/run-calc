# Local equivalent of the full CI pipeline (Verify + Build).
# Run this before committing to catch failures early.
# Usage: .\scripts\ci-verify.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
Push-Location $root

try {
    Write-Host "`n==> Go tests" -ForegroundColor Cyan
    go test ./...

    Write-Host "`n==> Frontend: install" -ForegroundColor Cyan
    Push-Location "$root\frontend"
    npm install --no-audit --no-fund

    Write-Host "`n==> Frontend: build" -ForegroundColor Cyan
    npm run build

    Write-Host "`n==> Frontend: tests" -ForegroundColor Cyan
    npm test

    Pop-Location

    Write-Host "`n==> Wails build (full app)" -ForegroundColor Cyan
    wails build -clean

    Write-Host "`nAll checks passed." -ForegroundColor Green
}
catch {
    Pop-Location -ErrorAction SilentlyContinue
    Write-Host "`nCheck failed: $_" -ForegroundColor Red
    exit 1
}
