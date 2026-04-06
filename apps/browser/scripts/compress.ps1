#!/usr/bin/env pwsh

####
# Compress the build directory into a zip file.
####

param (
    [Parameter(Mandatory = $true)]
    [String] $fileName
)

$buildDir = Join-Path $PSScriptRoot "../build"
$distDir = Join-Path $PSScriptRoot "../dist"

# Create dist directory if it doesn't exist
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir
}

$distPath = Join-Path -Path $distDir -ChildPath $fileName

if (Test-Path $distPath) {
    Remove-Item $distPath
}

# Compress build directory
if (Test-Path $buildDir) {
    Compress-Archive -Path (Join-Path $buildDir "*") -DestinationPath $distPath
    Write-Output "Zipped $buildDir into $distPath"
}
