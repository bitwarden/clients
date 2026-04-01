#!/usr/bin/env pwsh

<#
.SYNOPSIS
Validates that the signed bitwarden_chromium_import_helper.exe thumbprint matches
the hardcoded value in signature.rs.

.DESCRIPTION
After signing, the SHA256 thumbprint of the certificate used to sign
bitwarden_chromium_import_helper.exe must match the EXPECTED_SIGNATURE_SHA256_THUMBPRINT
constant in chromium_importer/src/chromium/platform/windows/signature.rs.
This script verifies that invariant holds, and fails if there is a mismatch.

.EXAMPLE
./scripts/validate-chromium-importer-thumbprint.ps1
#>

$ErrorActionPreference = "Stop"

$appDesktopDir = Split-Path $PSScriptRoot -Parent
$distDir = Join-Path $appDesktopDir "dist"
$helperExe = "bitwarden_chromium_import_helper.exe"
$helperPath = Get-ChildItem -Path $distDir -Recurse -Filter $helperExe | Select-Object -First 1 -ExpandProperty FullName
if ($null -eq $helperPath) {
    Write-Error "Could not find $helperExe in $distDir"
    exit 1
}

$sig = Get-AuthenticodeSignature $helperPath
if ($null -eq $sig.SignerCertificate) {
    Write-Error "No authenticode signature found on $helperPath"
    exit 1
}
$actual = $sig.SignerCertificate.GetCertHashString("SHA256").ToLower()

$signatureFile = Join-Path $appDesktopDir "desktop_native/chromium_importer/src/chromium/platform/windows/signature.rs"
if (-not (Test-Path $signatureFile)) {
    Write-Error "Could not find $(Split-Path $signatureFile -Leaf) at $signatureFile"
    exit 1
}
$content = Get-Content $signatureFile -Raw
$hardcoded = [regex]::Match($content, 'EXPECTED_SIGNATURE_SHA256_THUMBPRINT[^"]*"([a-f0-9]{64})"').Groups[1].Value

if ([string]::IsNullOrEmpty($hardcoded)) {
    Write-Error "Could not extract EXPECTED_SIGNATURE_SHA256_THUMBPRINT from $(Split-Path $signatureFile -Leaf)"
    exit 1
}

if ($actual -ne $hardcoded) {
    Write-Error "Thumbprint mismatch! Binary has '$actual' but signature.rs has '$hardcoded'. Update EXPECTED_SIGNATURE_SHA256_THUMBPRINT."
    exit 1
}

Write-Host "Thumbprint verified: $actual"
