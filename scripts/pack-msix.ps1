# Build and package Run-Calc as an MSIX for local testing or Partner Center upload.
# Usage: .\scripts\pack-msix.ps1 [-Version 0.5.1.0] [-SelfSign] [-PfxPath .\build\certs\cert.pfx] [-PfxPassword "pass"]
#
# Prerequisites:
#   - wails build -clean must have been run (or pass -SkipBuild)
#   - App Certification Kit installed (makeappx.exe detected automatically)
#
# Output: build\bin\Run-Calc-<version>-windows.msix

[CmdletBinding()]
param(
    [string] $Version = "0.5.1.0",
    [switch] $SkipBuild,
    [switch] $SelfSign,
    [string] $CertSubject,
    [string] $PfxPath,
    [string] $PfxPassword
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
Push-Location $root

try {
    # 1. Locate makeappx.exe
    $makeappx = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10" -Recurse -Filter "makeappx.exe" -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
    if (-not $makeappx) {
        $makeappx = Get-ChildItem "C:\Program Files\Windows Kits\10" -Recurse -Filter "makeappx.exe" -ErrorAction SilentlyContinue |
            Select-Object -First 1 -ExpandProperty FullName
    }
    if (-not $makeappx) {
        throw "makeappx.exe not found. Install the Windows App Certification Kit from https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/"
    }
    Write-Host "==> makeappx: $makeappx" -ForegroundColor Cyan

    $signtool = $null
    if ($SelfSign) {
        # Prefer App Certification Kit signtool — it reliably signs MSIX files.
        $ackSigntool = "C:\Program Files (x86)\Windows Kits\10\App Certification Kit\signtool.exe"
        if (Test-Path $ackSigntool) {
            $signtool = $ackSigntool
        } else {
            $signtool = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10" -Recurse -Filter "signtool.exe" -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -match 'x64' } |
                Select-Object -First 1 -ExpandProperty FullName
            if (-not $signtool) {
                $signtool = Get-ChildItem "C:\Program Files\Windows Kits\10" -Recurse -Filter "signtool.exe" -ErrorAction SilentlyContinue |
                    Where-Object { $_.FullName -match 'x64' } |
                    Select-Object -First 1 -ExpandProperty FullName
            }
            if (-not $signtool) {
                throw "signtool.exe not found. Install Windows SDK Signing Tools."
            }
        }
        Write-Host "==> signtool: $signtool" -ForegroundColor Cyan
    }

    # 2. Optionally build the app
    if (-not $SkipBuild) {
        Write-Host "`n==> wails build" -ForegroundColor Cyan
        wails build -clean
    }

    $exe = Join-Path $root "build\bin\Run-Calc.exe"
    if (-not (Test-Path $exe)) {
        throw "Executable not found at $exe. Run wails build first, or omit -SkipBuild."
    }

    # 3. Assemble staging directory
    $staging = Join-Path $root "build\bin\msix-staging"
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    New-Item $staging -ItemType Directory | Out-Null

    # Copy exe
    Copy-Item $exe $staging

    # Copy store assets
    $assetsDir = Join-Path $root "build\windows\store-assets"
    Copy-Item $assetsDir $staging -Recurse

    # Copy manifest with Identity version substituted only
    $manifestPath = Join-Path $root "build\windows\AppxManifest.xml"
    $manifest = Get-Content $manifestPath -Raw
    $pattern = '(<Identity\b[\s\S]*?\bVersion=")[^"]*(")'
    $publisherPattern = '(<Identity\b[\s\S]*?\bPublisher=")([^"]+)(")'

    $publisherMatch = [regex]::Match($manifest, $publisherPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $publisherMatch.Success) {
        throw "Failed to locate Identity Publisher in $manifestPath."
    }
    if ($SelfSign -and [string]::IsNullOrWhiteSpace($CertSubject)) {
        $CertSubject = $publisherMatch.Groups[2].Value
    }

    if (-not [regex]::IsMatch($manifest, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        throw "Failed to locate Identity Version in $manifestPath."
    }
    $replacement = '${1}' + $Version + '${2}'
    $manifestUpdated = [regex]::Replace(
        $manifest,
        $pattern,
        $replacement,
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )
    Set-Content (Join-Path $staging "AppxManifest.xml") $manifestUpdated -Encoding UTF8

    Write-Host "`n==> Staging contents:" -ForegroundColor Cyan
    Get-ChildItem $staging -Recurse | Select-Object -ExpandProperty FullName | ForEach-Object { Write-Host "    $_" }

    # 4. Pack
    $outMsix = Join-Path $root "build\bin\Run-Calc-$Version-windows.msix"
    if (Test-Path $outMsix) {
        Remove-Item $outMsix -Force
    }
    Write-Host "`n==> Packing MSIX..." -ForegroundColor Cyan
    & $makeappx pack /d $staging /p $outMsix /nv /o
    if ($LASTEXITCODE -ne 0) { throw "makeappx failed with exit code $LASTEXITCODE" }

    if ($SelfSign) {
        Write-Host "`n==> Self-signing MSIX for local testing..." -ForegroundColor Cyan

        if (-not [string]::IsNullOrWhiteSpace($PfxPath)) {
            # --- PFX provided: sign directly ---
            $pfxFull = (Resolve-Path $PfxPath -ErrorAction Stop).Path
            Write-Host "==> Signing with: $pfxFull" -ForegroundColor Cyan
            $signArgs = [System.Collections.Generic.List[string]] @('sign', '/fd', 'SHA256', '/a', '/f', $pfxFull)
            if (-not [string]::IsNullOrWhiteSpace($PfxPassword)) {
                $signArgs.Add('/p'); $signArgs.Add($PfxPassword)
            }
            $signArgs.Add($outMsix)
            & $signtool @signArgs
            if ($LASTEXITCODE -ne 0) { throw "signtool failed with exit code $LASTEXITCODE" }
            Write-Host "Signed with PFX: $pfxFull" -ForegroundColor Green
        }
        else {
            # --- No PFX: create/reuse self-signed cert, export to temp PFX, sign ---
            Write-Host "==> cert subject: $CertSubject" -ForegroundColor Cyan

            $cert = Get-ChildItem Cert:\CurrentUser\My |
                Where-Object {
                    $_.Subject -eq $CertSubject -and
                    $_.HasPrivateKey -and
                    $_.NotAfter -gt (Get-Date)
                } |
                Sort-Object NotAfter -Descending |
                Select-Object -First 1

            if ($null -eq $cert) {
                $cert = New-SelfSignedCertificate `
                    -Type Custom `
                    -KeyUsage DigitalSignature `
                    -Subject $CertSubject `
                    -CertStoreLocation "Cert:\CurrentUser\My" `
                    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}") `
                    -KeyAlgorithm RSA `
                    -KeyLength 2048 `
                    -HashAlgorithm SHA256 `
                    -NotAfter (Get-Date).AddYears(3)
                Write-Host "Created cert: $($cert.Thumbprint)" -ForegroundColor Cyan
            }
            else {
                Write-Host "Using existing cert: $($cert.Thumbprint)" -ForegroundColor Cyan
            }

            # Trust the cert for current-user sideload install.
            $certFile = Join-Path $staging "Run-Calc-TestCert.cer"
            Export-Certificate -Cert $cert -FilePath $certFile -Force | Out-Null
            Import-Certificate -FilePath $certFile -CertStoreLocation "Cert:\CurrentUser\TrustedPeople" | Out-Null
            Import-Certificate -FilePath $certFile -CertStoreLocation "Cert:\CurrentUser\Root" | Out-Null

            # Export to temp PFX so signtool can use the /f approach (thumbprint-based fails on some SDK builds).
            $tmpPwd = "TmpSign$(Get-Random)x!"
            $tmpPfx = Join-Path $env:TEMP "rc-sign-$($cert.Thumbprint).pfx"
            $secureTmpPwd = ConvertTo-SecureString $tmpPwd -AsPlainText -Force
            Export-PfxCertificate -Cert $cert -FilePath $tmpPfx -Password $secureTmpPwd | Out-Null
            try {
                & $signtool sign /fd SHA256 /a /f $tmpPfx /p $tmpPwd $outMsix
                if ($LASTEXITCODE -ne 0) { throw "signtool failed with exit code $LASTEXITCODE" }
            }
            finally {
                Remove-Item $tmpPfx -Force -ErrorAction SilentlyContinue
            }

            Write-Host "Self-signed with: $CertSubject ($($cert.Thumbprint))" -ForegroundColor Green
            Write-Host "Cert exported to: $certFile" -ForegroundColor Green
        }
    }

    Write-Host "`n==> Done: $outMsix" -ForegroundColor Green
}
finally {
    Pop-Location
}
