#!/usr/bin/env pwsh

<#
.SYNOPSIS
Validates the signing state and publisher of every Appx package in dist.

.DESCRIPTION
Two kinds of Appx come out of the same build. The `*-store.appx` packages have to stay
unsigned and keep the Microsoft-assigned publisher, or the Store rejects them. The
directly installable packages have to be signed and carry the signing certificate's
subject as their publisher, or they install for nobody. Getting either wrong produces an
artifact that looks fine until it is published, so this checks both before we ship.

A package is signed when it contains an AppxSignature.p7x entry, which is what signtool
adds. The publisher lives in the Identity element of the packaged AppxManifest.xml, and
signing only succeeds when it matches the certificate subject, so checking the publisher
also pins the signed packages to the expected certificate.

.EXAMPLE
./scripts/validate-appx-signatures.ps1 -Config electron-builder.beta.json -SignedPublisher $env:_APPX_PUBLISHER
#>
param(
    [string]
    # electron-builder config the packages were built from. Its appx.publisher is the
    # Microsoft-assigned publisher that the Store packages must keep.
    $Config = "electron-builder.json",

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]
    # Subject of the signing certificate, which the signed packages must name as publisher.
    $SignedPublisher
)

$ErrorActionPreference = "Stop"

$appDesktopDir = Split-Path $PSScriptRoot -Parent
$distDir = Join-Path $appDesktopDir "dist"

$configPath = Join-Path $appDesktopDir $Config
$storePublisher = (Get-Content $configPath -Raw | ConvertFrom-Json).appx.publisher
if ([string]::IsNullOrEmpty($storePublisher)) {
    Write-Error "Could not read appx.publisher from $configPath"
    exit 1
}

function Read-AppxIdentity {
    param([string]$Path)

    $package = [System.IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $manifestEntry = $package.GetEntry("AppxManifest.xml")
        if ($null -eq $manifestEntry) {
            Write-Error "No AppxManifest.xml in $Path"
            exit 1
        }

        $stream = $manifestEntry.Open()
        try {
            $reader = New-Object System.IO.StreamReader($stream)
            $manifest = [xml]$reader.ReadToEnd()
        }
        finally {
            $stream.Dispose()
        }

        return @{
            Publisher = $manifest.Package.Identity.Publisher
            IsSigned  = $null -ne $package.GetEntry("AppxSignature.p7x")
        }
    }
    finally {
        $package.Dispose()
    }
}

$packages = @(Get-ChildItem -Path $distDir -Filter *.appx)
$storePackages = @($packages | Where-Object { $_.Name.EndsWith("-store.appx") })
$signedPackages = @($packages | Where-Object { -not $_.Name.EndsWith("-store.appx") })
if ($storePackages.Count -eq 0 -or $signedPackages.Count -eq 0) {
    Write-Error "Expected both store and directly installable Appx packages in $distDir, found $($storePackages.Count) store and $($signedPackages.Count) other."
    exit 1
}

$problems = @()
foreach ($package in $packages) {
    $isStorePackage = $package.Name.EndsWith("-store.appx")
    $identity = Read-AppxIdentity -Path $package.FullName
    $expectedPublisher = if ($isStorePackage) { $storePublisher } else { $SignedPublisher }

    if ($isStorePackage -and $identity.IsSigned) {
        $problems += "$($package.Name) is signed, but Store packages must be unsigned."
    }
    if (-not $isStorePackage -and -not $identity.IsSigned) {
        $problems += "$($package.Name) is unsigned, but packages for direct download must be signed."
    }
    if ($identity.Publisher -ne $expectedPublisher) {
        $problems += "$($package.Name) has publisher '$($identity.Publisher)', expected '$expectedPublisher'."
    }

    $signingState = if ($identity.IsSigned) { "signed" } else { "unsigned" }
    Write-Host "$($package.Name): $signingState, publisher '$($identity.Publisher)'"
}

if ($problems.Count -gt 0) {
    Write-Error ("Appx validation failed:`n" + ($problems -join "`n"))
    exit 1
}

Write-Host "Verified $($storePackages.Count) unsigned Store and $($signedPackages.Count) signed Appx packages"
