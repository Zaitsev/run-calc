# Deploy help-site to Firebase Hosting
# Builds the site first, then deploys using npx firebase

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path $PSScriptRoot -Parent
$siteDir  = Join-Path $repoRoot 'site'

Write-Host "Building site..." -ForegroundColor Cyan
Push-Location $siteDir
try {
    npm run build
} finally {
    Pop-Location
}

Write-Host "Deploying to Firebase Hosting..." -ForegroundColor Cyan
Push-Location $repoRoot
try {
    npx firebase deploy --only hosting
} finally {
    Pop-Location
}

Write-Host "Deploy complete." -ForegroundColor Green
