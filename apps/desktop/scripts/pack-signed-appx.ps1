#!/usr/bin/env pwsh

<#
.SYNOPSIS
Repackages an already-built Windows app directory as a signed Appx.

.DESCRIPTION
An Appx names its publisher in the package manifest, and signing fails unless that
publisher matches the subject of the signing certificate. Store packages therefore have
to keep the Microsoft-assigned publisher (a UUID) and stay unsigned, which leaves them
uninstallable by anyone outside the Store.

To offer a directly installable Appx as well, this script rebuilds only the Appx target
from the `dist/win*-unpacked` directories electron-builder already produced, overriding
the publisher to the certificate subject and signing the result. Nothing is recompiled
and the app binaries keep the signatures from the original pack, so this costs one Appx
compression pass per architecture instead of a second full build.

The signed Appx lands on the configured `appx.artifactName`, so move or rename the
unsigned Store package first if both are wanted.

.PARAMETER Publisher
Subject of the signing certificate, e.g. `CN=Contoso Inc., O=Contoso Inc., C=US`. Signing
rejects any other value, so read it off a binary the same certificate signed rather than
hardcoding it.

.EXAMPLE
$publisher = (Get-AuthenticodeSignature "./dist/win-unpacked/Bitwarden Beta.exe").SignerCertificate.Subject
./scripts/pack-signed-appx.ps1 -Publisher $publisher -Config electron-builder.beta.json

.NOTES
Signing is delegated to `sign.js`, which needs ELECTRON_BUILDER_SIGN=1 plus its Azure
Key Vault environment, and ELECTRON_BUILDER_SIGN_APPX=1 to sign Appx files at all.
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]
    $Publisher,

    [string]
    # electron-builder config to pack with.
    $Config = "electron-builder.json",

    [ValidateSet("ia32", "x64", "arm64")]
    [string[]]
    # Architectures to repackage. Each needs its `dist/win*-unpacked` directory present.
    $Architectures = @("ia32", "x64", "arm64")
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

Push-Location $PSScriptRoot/..
try {
    foreach ($arch in $Architectures) {
        # electron-builder omits the arch suffix for the default architecture.
        $unpackedDir = if ($arch -eq "x64") { "dist/win-unpacked" } else { "dist/win-$arch-unpacked" }
        if (!(Test-Path $unpackedDir)) {
            Write-Error "$unpackedDir not found. Pack the $arch app before repackaging it as a signed Appx."
            exit 1
        }

        Write-Host "Packaging signed $arch Appx from $unpackedDir with publisher '$Publisher'"
        & npx electron-builder `
            --config $Config `
            --win appx `
            --$arch `
            --prepackaged $unpackedDir `
            --publish never `
            "-c.appx.publisher=$Publisher"
    }
}
finally {
    Pop-Location
}
