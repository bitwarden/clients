#!/usr/bin/env pwsh
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("X64", "ARM64")]$Architecture,
    $CertificatePath,
    [SecureString]$CertificatePassword,
    $ElectronConfigFile="electron-builder.json",
    [Switch]$Release=$false
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

cd $PSScriptRoot

$builderConfig = Get-Content $ElectronConfigFile | ConvertFrom-Json
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
& npx electron-builder --config $ElectronConfigFile --publish never --dir --win --$arch

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
    $cert = (Get-Item $CertificatePath).FullName
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
