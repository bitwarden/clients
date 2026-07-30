#!/usr/bin/env pwsh
param(
    $CertificatePath,
    $CertificatePassword,
    $ElectronConfigFile="electron-builder.json",
    $Target="debug"
)
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
$startTime = get-Date
$originalLocation = Get-Location
try {

cd $PSScriptRoot

$builderConfig = Get-Content $ElectronConfigFile | ConvertFrom-Json
$packageConfig = Get-Content package.json | ConvertFrom-Json
$manifestTemplate = Get-Content custom-appx-manifest.xml

$srcDir = Get-Location
$assetsDir = Get-Item $builderConfig.directories.buildResources
$buildDir = Get-Item $builderConfig.directories.app
$outDir = Join-Path (Get-Location) ($builderConfig.directories.output ?? "dist")

if ($target -eq "release") {
    $targetStr = "--release"
}
$arch = 'arm64'
$ext = "appx"
$version = Get-Date -Format "yyyy.M.d.Hmm"
# $buildNumber = Get-Date -Format "HHmm"
# $version = "$($packageConfig.version).$buildNumber"
$productName = $builderConfig.productName
$artifactName = "${productName}-$($packageConfig.version)-${arch}.$ext"

Write-Host "Building native code"
npm run build-native-win-cross -- $targetStr

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
Move-Item (Join-Path $outDir "win-${arch}-unpacked") $appxDir

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
Write-Host ("Finished in $($elapsed.ToString('mm')) minutes and $($elapsed.ToString('ss')).$($elapsed.ToString('fff')) seconds")
}
finally {
    Set-Location -Path $originalLocation
}