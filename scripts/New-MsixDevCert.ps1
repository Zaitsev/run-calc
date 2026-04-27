# Creates (or reuses) a self-signed code-signing certificate for local MSIX test signing.
# Run this once per machine, then use pack-msix.ps1 -SelfSign to sign packages.
#
# Usage:
#   .\scripts\New-MsixDevCert.ps1
#   .\scripts\New-MsixDevCert.ps1 -Password "MyPass" -Trust
#
# Output: build\certs\Run-Calc-Dev.pfx  (path also written to stdout for scripting use)

[CmdletBinding()]
param(
    # Password to protect the exported PFX. Empty string = no password.
    [string] $Password = "",
    # Where to write the PFX. Defaults to build\certs\Run-Calc-Dev.pfx.
    [string] $OutPfx,
    # Override cert Subject (CN=...). Auto-read from AppxManifest.xml if omitted.
    [string] $Subject,
    # If set, imports the public cert into CurrentUser\TrustedPeople and CurrentUser\Root
    # so Windows trusts the package for sideload installation.
    [switch] $Trust
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
Push-Location $root

try {
    # Resolve subject from manifest when not explicitly provided
    if ([string]::IsNullOrWhiteSpace($Subject)) {
        $manifestPath = Join-Path $root "build\windows\AppxManifest.xml"
        $manifest = Get-Content $manifestPath -Raw
        $m = [regex]::Match($manifest, '<Identity\b[\s\S]*?\bPublisher="([^"]+)"',
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if (-not $m.Success) { throw "Cannot read Publisher from $manifestPath" }
        $Subject = $m.Groups[1].Value
    }

    if ([string]::IsNullOrWhiteSpace($OutPfx)) {
        $OutPfx = Join-Path $root "build\certs\Run-Calc-Dev.pfx"
    }
    $OutPfx = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutPfx)

    Write-Host "==> Subject : $Subject" -ForegroundColor Cyan
    Write-Host "==> Output  : $OutPfx" -ForegroundColor Cyan

    # Reuse an existing valid cert with this subject so we don't accumulate certs
    $cert = Get-ChildItem Cert:\CurrentUser\My |
        Where-Object { $_.Subject -eq $Subject -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) } |
        Sort-Object NotAfter -Descending |
        Select-Object -First 1

    if ($null -eq $cert) {
        Write-Host "==> Creating new certificate..." -ForegroundColor Cyan
        $cert = New-SelfSignedCertificate `
            -Type Custom `
            -KeyUsage DigitalSignature `
            -Subject $Subject `
            -CertStoreLocation "Cert:\CurrentUser\My" `
            -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}") `
            -KeyAlgorithm RSA `
            -KeyLength 2048 `
            -HashAlgorithm SHA256 `
            -NotAfter (Get-Date).AddYears(3) `
            -FriendlyName "Run-Calc Dev Cert"
        Write-Host "==> Created  : $($cert.Thumbprint)" -ForegroundColor Green
    }
    else {
        Write-Host "==> Reusing  : $($cert.Thumbprint) (expires $($cert.NotAfter.ToString('yyyy-MM-dd')))" -ForegroundColor Green
    }

    # Export PFX (contains private key — keep this file local, never commit)
    New-Item -ItemType Directory -Path (Split-Path $OutPfx) -Force | Out-Null
    $securePwd = ConvertTo-SecureString $Password -AsPlainText -Force
    Export-PfxCertificate -Cert $cert -FilePath $OutPfx -Password $securePwd -Force | Out-Null
    Write-Host "==> PFX saved: $OutPfx" -ForegroundColor Cyan

    if ($Trust) {
        # MSIX installation is performed by the AppX deployment service (runs as SYSTEM).
        # It only checks LocalMachine stores — CurrentUser imports are invisible to it.
        # Requires an elevated (Administrator) PowerShell prompt.

        # Remove stale certs with same Subject but different thumbprint from LocalMachine stores.
        foreach ($store in @('TrustedPeople', 'Root')) {
            $stale = @(Get-ChildItem "Cert:\LocalMachine\$store" -ErrorAction SilentlyContinue |
                Where-Object { $_.Subject -eq $Subject -and $_.Thumbprint -ne $cert.Thumbprint })
            if ($stale.Count -gt 0) {
                Write-Host ""
                Write-Warning "Found $($stale.Count) stale cert(s) with Subject '$Subject' in LocalMachine\${store}:"
                $stale | ForEach-Object { Write-Host "    $($_.Thumbprint)  expires $($_.NotAfter.ToString('yyyy-MM-dd'))" -ForegroundColor Yellow }
                Write-Warning "Removing these will revoke trust for any package signed with them on this machine."
                $confirm = Read-Host "Type YES to remove stale cert(s) from LocalMachine\$store"
                if ($confirm -eq 'YES') {
                    $stale | ForEach-Object {
                        $thumb = $_.Thumbprint
                        $path  = $_.PSPath
                        try {
                            Remove-Item $path -ErrorAction Stop
                            Write-Host "==> Removed from LocalMachine\${store}: $thumb" -ForegroundColor Yellow
                        } catch {
                            Write-Warning "Could not remove $thumb from LocalMachine\${store}: $_`n    Run from an elevated (Administrator) PowerShell."
                        }
                    }
                } else {
                    Write-Host "==> Skipped removal from LocalMachine\$store." -ForegroundColor Yellow
                }
            }
        }

        $cerFile = [System.IO.Path]::ChangeExtension($OutPfx, '.cer')
        Export-Certificate -Cert $cert -FilePath $cerFile -Force | Out-Null
        try {
            Import-Certificate -FilePath $cerFile -CertStoreLocation "Cert:\LocalMachine\TrustedPeople" | Out-Null
            Import-Certificate -FilePath $cerFile -CertStoreLocation "Cert:\LocalMachine\Root" | Out-Null
            Write-Host "==> Trusted in LocalMachine\TrustedPeople + Root ($($cert.Thumbprint))" -ForegroundColor Green
        } catch {
            throw "Failed to import certificate into LocalMachine stores: $_`n    Run this script from an elevated (Administrator) PowerShell."
        }
    }

    $pwdHint = if ([string]::IsNullOrEmpty($Password)) { '(no password)' } else { '"' + $Password + '"' }
    Write-Host "`n==> Ready. Sign packages with:" -ForegroundColor Green
    Write-Host "    .\scripts\pack-msix.ps1 -SkipBuild -SelfSign -PfxPath '$OutPfx' -PfxPassword $pwdHint" -ForegroundColor White

    # Write path to stdout so callers can capture it: $pfx = & .\scripts\New-MsixDevCert.ps1 ...
    Write-Output $OutPfx
}
finally {
    Pop-Location
}
