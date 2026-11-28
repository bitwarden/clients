#!/usr/bin/env pwsh

####
# Builds the safari appex and code-signs it for both mas and dmg variants.
# xcodebuild runs once; the resulting appex is copied and signed separately for each variant.
####

$buildDir = Join-Path $PSScriptRoot "../build"
$distDir = Join-Path $PSScriptRoot "../dist"

Write-Output $PSScriptRoot

if (-not (Test-Path $buildDir)) {
    Write-Output "No build directory found. Exiting..."
    exit
}

# Create dist directory if it doesn't exist
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir
}

$safariSrc = Join-Path $PSScriptRoot "../src/safari"
$safariDistPath = Join-Path -Path $distDir -ChildPath "Safari"

if (-not (Test-Path $safariDistPath)) {
    New-Item -ItemType Directory -Path $safariDistPath
}

# Delete old safari dists
Remove-Item -LiteralPath $safariDistPath -Force -Recurse

$entitlementsPath = Join-Path -Path $safariSrc -ChildPath "safari/safari.entitlements"

# --- Build once ---

$safariBuildPath = Join-Path -Path $safariDistPath -ChildPath "build"

# Copy safari src
Copy-Item -Path $safariSrc -Destination $safariBuildPath -Recurse

# Copy build
$target = Join-Path -Path $safariBuildPath -ChildPath "safari/app"
Copy-Item -Path $buildDir -Destination $target -Recurse

# Update versions
$jsonFilePath = Join-Path $buildDir "manifest.json"
$jsonContent  = Get-Content -Path $jsonFilePath -Raw
$jsonObject   = $jsonContent | ConvertFrom-Json

$infoFile = Join-Path -Path $safariBuildPath -ChildPath "safari/Info.plist"
(Get-Content $infoFile).Replace('0.0.1', $jsonObject.version).Replace('0.0.2', $jsonObject.version) | Set-Content $infoFile

$projectFile = Join-Path -Path $safariBuildPath -ChildPath "desktop.xcodeproj/project.pbxproj"
(Get-Content $projectFile).Replace('../../../build', "../safari/app") | Set-Content $projectFile

$xcodeBuildArgs = @(
    "-project", (Join-Path $safariBuildPath "desktop.xcodeproj"),
    "-alltargets",
    "-configuration", "Release"
)
& xcodebuild @xcodeBuildArgs 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "xcodebuild failed with exit code $LASTEXITCODE"
}

$builtAppexPath = Join-Path -Path $safariBuildPath -ChildPath "build/Release/safari.appex"

# Verify the appex actually contains its executable. A compile/link failure can leave a bundle
# with the Info.plist and resources but no Mach-O binary, which only surfaces much later as a
# "Bad CFBundleExecutable" error during App Store validation.
$appexExecutablePath = Join-Path -Path $builtAppexPath -ChildPath "Contents/MacOS/safari"
if (-not (Test-Path $appexExecutablePath)) {
    throw "Built appex is missing its executable at $appexExecutablePath"
}

# --- Sign once per variant ---

$variants = @(
    @{
        Name         = "mas"
        CodesignArgs = @(
            "--verbose", "--force",
            "--sign", "3rd Party Mac Developer Application: Bitwarden Inc",
            "--entitlements", $entitlementsPath
        )
    },
    @{
        Name         = "dmg"
        CodesignArgs = @(
            "--verbose", "--force",
            "-o", "runtime",
            "--sign", "Developer ID Application: Bitwarden Inc",
            "--entitlements", $entitlementsPath
        )
    }
)

foreach ($variant in $variants) {
    $variantAppexPath = Join-Path -Path $safariDistPath -ChildPath "$($variant.Name)/build/Release/safari.appex"

    New-Item -ItemType Directory -Path (Split-Path $variantAppexPath) -Force | Out-Null
    Copy-Item -Path $builtAppexPath -Destination $variantAppexPath -Recurse

    $codesignArgs = $variant.CodesignArgs
    $frameworkPath = Join-Path -Path $variantAppexPath -ChildPath "Contents/Frameworks"

    $libs = Get-ChildItem -Path $frameworkPath -Filter "*.dylib" -ErrorAction SilentlyContinue
    foreach ($lib in $libs) {
        & codesign @codesignArgs $lib.FullName 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "codesign failed for '$($lib.FullName)' with exit code $LASTEXITCODE"
        }
    }

    & codesign @codesignArgs $variantAppexPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "codesign failed for '$variantAppexPath' with exit code $LASTEXITCODE"
    }

    Write-Output "[$($variant.Name)] Sign completed successfully"
}

Write-Output "Safari build completed successfully"
