#!/usr/bin/env pwsh
param(
    [Parameter(Mandatory=$true)]
    [System.Runtime.InteropServices.Architecture]$Architecture,
    $CertificatePath,
    $CertificatePassword,
    $ElectronConfigFile="electron-builder.json",
    [Switch]$Release=$false
)
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
$startTime = Get-Date
$originalLocation = Get-Location
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
$rustTarget = switch ($Architecture) {
    X64 { "x86_64-pc-windows-msvc" }
    ARM64 { "aarch64-pc-windows-msvc" }
    default {
        Write-Error "Unsupported architecture: $Architecture. Supported architectures are x64 and arm64"
        Exit(1)
    }
}
npm run build-native -- cross-platform $buildConfiguration "--target=$rustTarget"

Write-Host "Building Javascript code"
if ($target -eq "release") {
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
if ($null -eq $CertificatePath || $null -eq $CertificatePassword) {
    Write-Warning "No Certificate specified. Not signing Appx."
}
else {

    $cert = (Get-Item $CertificatePath).FullName
    $pw = $CertificatePassword
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