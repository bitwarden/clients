# Build the sparse MSIX package for Windows 11 modern context menu support.
#
# This script takes the AppxManifest.xml template, substitutes build-time
# variables, and packages it into a sparse MSIX using MakeAppx.exe.
#
# Usage:
#   .\build-sparse-package.ps1 -Arch x64 -Version 2025.1.0.0 -Publisher "CN=..."
#
# Prerequisites:
#   - MakeAppx.exe must be on PATH (included in Windows SDK)
#   - The shell extension DLL must already be built

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("x64", "arm64")]
    [string]$Arch,

    [Parameter(Mandatory=$true)]
    [string]$Version,

    [Parameter(Mandatory=$true)]
    [string]$Publisher,

    [string]$OutputDir = (Join-Path $PSScriptRoot ".." "desktop_native" "dist")
)

$ErrorActionPreference = "Stop"

$templatePath = Join-Path $PSScriptRoot ".." "resources" "sparse-package" "AppxManifest.xml"
$stagingDir = Join-Path ([System.IO.Path]::GetTempPath()) "bitwarden-sparse-$(New-Guid)"
$outputMsix = Join-Path $OutputDir "bitwarden-sparse.msix"

try {
    # Create staging directory
    New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

    # Read and substitute template variables
    $manifest = Get-Content $templatePath -Raw
    $manifest = $manifest.Replace('${arch}', $Arch)
    $manifest = $manifest.Replace('${version}', $Version)
    $manifest = $manifest.Replace('${publisher}', $Publisher)

    # Write the processed manifest
    $manifestPath = Join-Path $stagingDir "AppxManifest.xml"
    Set-Content -Path $manifestPath -Value $manifest -Encoding UTF8

    # Ensure output directory exists
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

    # Package as sparse MSIX (no content files — the manifest references
    # external executables via the sparse package's ExternalLocationUri)
    Write-Host "Creating sparse MSIX package: $outputMsix"
    & MakeAppx.exe pack /d $stagingDir /p $outputMsix /nv /o
    if ($LASTEXITCODE -ne 0) {
        throw "MakeAppx.exe failed with exit code $LASTEXITCODE"
    }

    Write-Host "Sparse MSIX package created successfully at: $outputMsix"
}
finally {
    # Clean up staging directory
    if (Test-Path $stagingDir) {
        Remove-Item -Recurse -Force $stagingDir
    }
}
