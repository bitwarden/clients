#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# This script prepares the environment for developing in Rust for the clients repo,
# specifically Desktop Native. This script is used by both developers locally, and
# in CI.
#
# NOTE: The cargo tools installed in this script, are installed to the default location
# (user's $HOME dir). If you prefer another location, please install the versions
# specified in apps/desktop/desktop_native/cargo-tool-versions, and ensure they are in your $PATH.

$versionsFile = Join-Path $PSScriptRoot "..\apps\desktop\desktop_native\cargo-tool-versions"

function Install-RustToolchain {
    if (-not (Get-Command rustup -ErrorAction SilentlyContinue)) {
        Write-Host "Installing Rust..."
        $rustupUrl = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") {
            "https://win.rustup.rs/aarch64"
        } else {
            "https://win.rustup.rs/x86_64"
        }
        $rustupInit = Join-Path $env:TEMP "rustup-init.exe"
        Invoke-WebRequest -Uri $rustupUrl -OutFile $rustupInit
        & $rustupInit -y --default-toolchain stable
        Remove-Item $rustupInit
    }

    # Ensure cargo/rustup are on PATH for the current session
    $cargoHome = if ($env:CARGO_HOME) { $env:CARGO_HOME } else { Join-Path $env:USERPROFILE ".cargo" }
    $cargoBin = Join-Path $cargoHome "bin"
    if ((Test-Path $cargoBin) -and ($env:PATH -notlike "*$cargoBin*")) {
        $env:PATH = "$cargoBin;$env:PATH"
    }

    # Determine desired toolchain and ensure it's installed.
    Push-Location "apps/desktop/desktop_native"
    try {
        $activeToolchain = rustup show active-toolchain 2>$null
    } catch {
        $activeToolchain = $null
    } finally {
        Pop-Location
    }

    if ($activeToolchain) {
        # Keep only the first token (strip trailing parenthetical info)
        $activeToolchain = ($activeToolchain -split '\s+')[0]
    }

    if ([string]::IsNullOrEmpty($activeToolchain)) {
        # No active toolchain yet: fall back to env override or default to stable.
        $activeToolchain = if ($env:RUSTUP_TOOLCHAIN) { $env:RUSTUP_TOOLCHAIN } else { "stable" }
        rustup default $activeToolchain
    }

    # For building desktop_native
    rustup toolchain install $activeToolchain

    # For the cargo tools used in pre-commit hooks and CI
    rustup toolchain install nightly

    rustup show
    Write-Host
}

# Checks version of tool and installs if needed
# Usage: Install-CargoToolIfNeeded <tool-name> <version> [<version-pattern>]
# Note: cargo-* tools are invoked as "cargo <subcommand>", not as direct binaries
function Install-CargoToolIfNeeded {
    param(
        [string]$Tool,
        [string]$Version,
        [string]$VersionPattern = ""
    )

    # Strip "cargo-" prefix to get the cargo subcommand name
    $subcommand = $Tool -replace "^cargo-", ""

    if ([string]::IsNullOrEmpty($VersionPattern)) {
        $VersionPattern = "$Tool $Version"
    }

    try {
        $versionOutput = & cargo $subcommand --version 2>$null
    } catch {
        $versionOutput = $null
    }
    if ($versionOutput -and ($versionOutput -match ("^" + [regex]::Escape($VersionPattern)))) {
        Write-Host "$Tool $Version is already installed."
    } else {
        Write-Host "$Tool $Version is not installed. Installing ..."
        cargo install $Tool --version $Version --force --locked
    }
}

Install-RustToolchain

Get-Content $versionsFile | ForEach-Object {
    if ($_ -match "^([^=]+)=(.+)$") {
        Install-CargoToolIfNeeded $Matches[1] $Matches[2]
    }
}
