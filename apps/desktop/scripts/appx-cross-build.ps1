#!/usr/bin/env pwsh

<#
.SYNOPSIS
Script to build, package and sign the Bitwarden desktop client as a Windows Appx
package.

.DESCRIPTION
This script provides cross-platform support for packaging and signing the
Bitwarden desktop client as a Windows Appx package.

Currently, only macOS -> Windows Appx is supported, but Linux -> Windows Appx
could be added in the future by providing Linux binaries for the msix-packaging
project.

.NOTES
The reason this script exists is because electron-builder does not currently
support cross-platform Appx packaging without proprietary tools (Parallels
Windows VM). This script uses third-party tools (makemsix from msix-packaging
and osslsigncode) to package and sign the Appx.

The signing certificate must have the same subject as the publisher name. This
can be generated on the Windows target using PowerShell 5.1 and copied to the
host, or directly on the host with OpenSSL.

Using Windows PowerShell 5.1:
```powershell
$publisher = "CN=Bitwarden Inc., O=Bitwarden Inc., L=Santa Barbara, S=California, C=US, SERIALNUMBER=7654941, OID.2.5.4.15=Private Organization, OID.1.3.6.1.4.1.311.60.2.1.2=Delaware, OID.1.3.6.1.4.1.311.60.2.1.3=US"
$certificate = New-SelfSignedCertificate -Type Custom -KeyUsage DigitalSignature -CertStoreLocation "Cert:\CurrentUser\My" -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}") -Subject $publisher -FriendlyName "Bitwarden Developer Signing Certificate"
$password = Read-Host -AsSecureString
Export-PfxCertificate -cert "Cert:\CurrentUser\My\${$certificate.Thumbprint}" -FilePath "C:\path/to/pfx" -Password $password
```

Using OpenSSL:
```sh
subject="jurisdictionCountryName=US/jurisdictionStateOrProvinceName=Delaware/businessCategory=Private Organization/serialNumber=7654941, C=US, ST=California, L=Santa Barbara, O=Bitwarden Inc., CN=Bitwarden Inc."
keyfile="/tmp/mysigning.rsa.pem"
certfile="/tmp/mysigning.cert.pem"
p12file="/tmp/mysigning.p12"
openssl req -x509 -keyout "$keyfile" -out "$certfile" -subj "$subject" \
    -newkey rsa:2048 -days 3650 -nodes \
    -addext 'keyUsage=critical,digitalSignature' \
    -addext 'extendedKeyUsage=critical,codeSigning' \
    -addext 'basicConstraints=critical,CA:FALSE'
openssl pkcs12 -inkey "$keyfile" -in "$certfile" -export -out "$p12file"
rm $keyfile
```

.EXAMPLE
./scripts/cross-build.ps1 -Architecture arm64 -CertificatePath ~/Development/code-signing.pfx -CertificatePassword (Read-Host -AsSecureString) -Release -Beta

Reads the signing certificate password from user input, then builds, packages
and signs the Appx.

Alternatively, you can specify the CERTIFICATE_PASSWORD environment variable.
#>
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("X64", "ARM64")]$Architecture,
    [string]
    # Path to PKCS12 certificate file. If not specified, the Appx will not be signed.
    $CertificatePath,
    [SecureString]
    # Password for PKCS12 certificate. Alternatively, may be specified in
    # CERTIFICATE_PASSWORD environment variable. If not specified, the Appx will
    # not be signed.
    $CertificatePassword,
    [Switch]
    # Whether to build the Beta version of the app.
    $Beta=$false,
    [Switch]
    # Whether to build in release mode.
    $Release=$false
)
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
$startTime = Get-Date
$originalLocation = Get-Location
if (!(Get-Command makemsix -ErrorAction SilentlyContinue)) {
    Write-Error "The `makemsix` tool from the msix-packaging project is required to construct Appx package."
    Write-Error "On macOS, you can install with Homebrew:"
    Write-Error "  brew install iinuwa/msix-packaging-tap/msix-packaging"
    Exit 1
}

if (!(Get-Command osslsigncode -ErrorAction SilentlyContinue)) {
    Write-Error "The `osslsigncode` tool is required to sign the Appx package."
    Write-Error "On macOS, you can install with Homebrew:"
    Write-Error "  brew install osslsigncode"
    Exit 1
}

if (!(Get-Command cargo-xwin -ErrorAction SilentlyContinue)) {
    Write-Error "The `cargo-xwin` tool is required to cross-compile Windows native code."
    Write-Error "You can install with cargo:"
    Write-Error "  cargo install --version 0.20.2 --locked cargo-xwin"
    Exit 1
}

try {

# Resolve certificate file before we change directories.
$CertificateFile = Get-Item $CertificatePath -ErrorAction SilentlyContinue

cd $PSScriptRoot/..

if ($Beta) {
  $electronConfigFile =  Get-Item "./electron-builder.beta.json"
}
else {
  $electronConfigFile = Get-Item "./electron-builder.json"
}

$builderConfig = Get-Content $electronConfigFile | ConvertFrom-Json
$packageConfig = Get-Content package.json | ConvertFrom-Json
$manifestTemplate = Get-Content $builderConfig.appx.customManifestPath

$srcDir = Get-Location
$assetsDir = Get-Item $builderConfig.directories.buildResources
$buildDir = Get-Item $builderConfig.directories.app
$outDir = Join-Path (Get-Location) ($builderConfig.directories.output ?? "dist")

if ($Release) {
    $buildConfiguration = "--release"
}
$arch = "$Architecture".ToLower()
$ext = "appx"
$version = Get-Date -Format "yyyy.M.d.1HHmm"
$productName = $builderConfig.productName
$artifactName = "${productName}-$($packageConfig.version)-${arch}.$ext"

Write-Host "Building native code"
$rustTarget = switch ($arch) {
    x64 { "x86_64-pc-windows-msvc" }
    arm64 { "aarch64-pc-windows-msvc" }
    default {
        Write-Error "Unsupported architecture: $Architecture. Supported architectures are x64 and arm64"
        Exit(1)
    }
}
npm run build-native -- cross-platform $buildConfiguration "--target=$rustTarget"

Write-Host "Building Javascript code"
if ($Release) {
    npm run build
}
else {
    npm run build:dev
}

Write-Host "Cleaning output folder"
Remove-Item -Recurse -Force $outDir -ErrorAction Ignore

Write-Host "Packaging Electron executable"
& npx electron-builder --config $electronConfigFile --publish never --dir --win --$arch

cd $outDir
New-Item -Type Directory (Join-Path $outDir "appx")

Write-Host "Building Appx directory structure"
$appxDir = (Join-Path $outDir appx/app)
if ($arch -eq "x64") {
    Move-Item (Join-Path $outDir "win-unpacked") $appxDir
}
else {
    Move-Item (Join-Path $outDir "win-${arch}-unpacked") $appxDir
}

Write-Host "Copying Assets"
New-Item -Type Directory (Join-Path $outDir appx/assets)
Copy-Item $srcDir/resources/appx/* $outDir/appx/assets/

Write-Host "Building Appx manifest"
$translationMap = @{
    'arch' = $arch
    'applicationId' = $builderConfig.appx.applicationId
    'displayName' = $productName
    'executable' = "app\${productName}.exe"
    'publisher' = $builderConfig.appx.publisher
    'publisherDisplayName' = $builderConfig.appx.publisherDisplayName
    'version' = $version
}

$manifest = $manifestTemplate
$translationMap.Keys | ForEach-Object {
    $manifest = $manifest.Replace("`${$_}", $translationMap[$_])
}
$manifest | Out-File appx/AppxManifest.xml
$unsignedArtifactpath = [System.IO.Path]::GetFileNameWithoutExtension($artifactName) + "-unsigned.$ext"
Write-Host "Creating unsigned Appx"
makemsix pack -d appx -p $unsignedArtifactpath

$outfile = Join-Path $outDir $unsignedArtifactPath
if ($null -eq $CertificatePath) {
    Write-Warning "No Certificate specified. Not signing Appx."
}
elseif ($null -eq $CertificatePassword -and $null -eq $env:CERTIFICATE_PASSWORD) {
    Write-Warning "No certificate password specified in CertificatePassword argument nor CERTIFICATE_PASSWORD environment variable. Not signing Appx."
}
else {
    $cert = $CertificateFile
    $pw = $null
    if ($null -ne $CertificatePassword) {
        $pw = ConvertFrom-SecureString -SecureString $CertificatePassword -AsPlainText
    } else {
        $pw = $env:CERTIFICATE_PASSWORD
    }
    $unsigned = $outfile
    $outfile = (Join-Path $outDir $artifactName)
    Write-Host "Signing $artifactName with $cert"
    osslsigncode sign `
        -pkcs12 "$cert" `
        -pass "$pw" `
        -in $unsigned `
        -out $outfile
    Remove-Item $unsigned
}

$endTime = Get-Date
$elapsed = $endTime - $startTime
Write-Host "Successfully packaged $(Get-Item $outfile)"
Write-Host ("Finished at $($endTime.ToString('HH:mm:ss')) in $($elapsed.ToString('mm')) minutes and $($elapsed.ToString('ss')).$($elapsed.ToString('fff')) seconds")
}
finally {
    Set-Location -Path $originalLocation
}
