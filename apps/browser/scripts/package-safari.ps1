#!/usr/bin/env pwsh

####
# Builds the safari appex.
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

$subBuildPaths = @("mas", "masdev", "dmg")
$safariSrc = Join-Path $PSScriptRoot "../src/safari"
$safariDistPath = Join-Path -Path $distDir -ChildPath "Safari"

if (-not (Test-Path $safariDistPath)) {
    New-Item -ItemType Directory -Path $safariDistPath
}

# Delete old safari dists
Remove-Item -LiteralPath $safariDistPath -Force -Recurse

foreach ($subBuildPath in $subBuildPaths) {
    $safariBuildPath = Join-Path -Path $safariDistPath -ChildPath $subBuildPath
    $builtAppexPath = Join-Path -Path $safariBuildPath -ChildPath "build/Release/safari.appex"
    $builtAppexFrameworkPath = Join-Path -Path $safariBuildPath -ChildPath "build/Release/safari.appex/Contents/Frameworks/"
    $entitlementsPath = Join-Path -Path $safariSrc -ChildPath "safari/safari.entitlements"

    switch ($subBuildPath) {
        "mas" {
            $codesignArgs = @(
                "--verbose",
                "--force",
                "--sign",
                '"3rd Party Mac Developer Application: Bitwarden Inc"',
                "--entitlements",
                $entitlementsPath
            )
        }
        "masdev" {
            $codesignArgs = @(
                "--verbose",
                "--force",
                "--sign",
                "588E3F1724AE018EBA762E42279DAE85B313E3ED",
                "--entitlements",
                $entitlementsPath
            )
        }
        "dmg" {
            $codesignArgs = @(
                "--verbose",
                "--force",
                "-o",
                "runtime",
                "--sign",
                '"Developer ID Application: 8bit Solutions LLC"',
                "--entitlements",
                $entitlementsPath
            )
        }
    }

    # Copy safari src
    Copy-Item -Path $safariSrc -Destination $safariBuildPath -Recurse

    # Copy build
    $target = Join-Path -Path $safariBuildPath -ChildPath "safari/app"
    Copy-Item -Path $buildDir -Destination $target -Recurse

    # Update versions
    $jsonFilePath = Join-Path $buildDir "manifest.json"
    $jsonContent = Get-Content -Path $jsonFilePath -Raw
    $jsonObject = $jsonContent | ConvertFrom-Json

    $infoFile = Join-Path -Path $safariBuildPath -ChildPath "safari/Info.plist"
        (Get-Content $infoFile).Replace('0.0.1', $jsonObject.version).Replace('0.0.2', $jsonObject.version) | Set-Content $infoFile

    $projectFile = Join-Path -Path $safariBuildPath -ChildPath "desktop.xcodeproj/project.pbxproj"
        (Get-Content $projectFile).Replace('../../../build', "../safari/app") | Set-Content $projectFile

    # Build using xcode
    $xcodeBuildArgs = @(
        "-project",
            (Join-Path $safariBuildPath "desktop.xcodeproj"),
        "-alltargets",
        "-configuration",
        "Release"
    )
    $proc = Start-Process "xcodebuild" -ArgumentList $xcodeBuildArgs -NoNewWindow -PassThru
    $proc.WaitForExit()

    # Codesign
    $libs = Get-ChildItem -Path $builtAppexFrameworkPath -Filter "*.dylib"
    foreach ($lib in $libs) {
        $proc = Start-Process "codesign" -ArgumentList ($codesignArgs + $lib.FullName) -NoNewWindow -PassThru
        $proc.WaitForExit()
    }

    $proc = Start-Process "codesign" -ArgumentList ($codesignArgs + $builtAppexPath) -NoNewWindow -PassThru
    $proc.WaitForExit()
}
