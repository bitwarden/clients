#!/usr/bin/env pwsh

####
# Builds the safari appex for both mas and dmg variants in parallel.
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

$variants = @(
    @{
        Name         = "mas"
        CodesignArgs = @(
            "--verbose", "--force",
            "--sign", '"3rd Party Mac Developer Application: Bitwarden Inc"',
            "--entitlements", $entitlementsPath
        )
    },
    @{
        Name         = "dmg"
        CodesignArgs = @(
            "--verbose", "--force",
            "-o", "runtime",
            "--sign", '"Developer ID Application: Bitwarden Inc"',
            "--entitlements", $entitlementsPath
        )
    }
)

$buildBlock = {
    param($variant, $safariDistPath, $safariSrc, $buildDir)

    $subBuildPath    = $variant.Name
    $codesignArgs    = $variant.CodesignArgs
    $safariBuildPath = Join-Path -Path $safariDistPath -ChildPath $subBuildPath

    $builtAppexPath          = Join-Path -Path $safariBuildPath -ChildPath "build/Release/safari.appex"
    $builtAppexFrameworkPath = Join-Path -Path $safariBuildPath -ChildPath "build/Release/safari.appex/Contents/Frameworks/"

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

    # Build using xcode. DerivedData is scoped per-variant to avoid collisions when both run in parallel.
    # Direct invocation (not Start-Process) so that stdout/stderr are captured by the background job
    # and surfaced via Receive-Job in CI logs.
    $xcodeBuildArgs = @(
        "-project", (Join-Path $safariBuildPath "desktop.xcodeproj"),
        "-derivedDataPath", (Join-Path $safariBuildPath "DerivedData"),
        "-alltargets",
        "-configuration", "Release"
    )
    & xcodebuild @xcodeBuildArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "xcodebuild failed for '$subBuildPath' with exit code $LASTEXITCODE"
    }

    # Verify the appex actually contains its executable. A compile/link failure can leave a bundle
    # with the Info.plist and resources but no Mach-O binary, which only surfaces much later as a
    # "Bad CFBundleExecutable" error during App Store validation.
    $appexExecutablePath = Join-Path -Path $builtAppexPath -ChildPath "Contents/MacOS/safari"
    if (-not (Test-Path $appexExecutablePath)) {
        throw "Built appex for '$subBuildPath' is missing its executable at $appexExecutablePath"
    }

    # Codesign — direct invocation so output is captured by the background job.
    $libs = Get-ChildItem -Path $builtAppexFrameworkPath -Filter "*.dylib"
    foreach ($lib in $libs) {
        & codesign @codesignArgs $lib.FullName 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "codesign failed for '$($lib.FullName)' with exit code $LASTEXITCODE"
        }
    }

    & codesign @codesignArgs $builtAppexPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "codesign failed for '$builtAppexPath' with exit code $LASTEXITCODE"
    }

    Write-Output "[$subBuildPath] Build and sign completed successfully"
}

# Launch both variants as background jobs so they run in parallel.
$jobs = $variants | ForEach-Object {
    Start-Job -Name $_.Name -ScriptBlock $buildBlock -ArgumentList $_, $safariDistPath, $safariSrc, $buildDir
}

# Wait for all jobs to finish before inspecting results, regardless of outcome.
$jobs | Wait-Job | Out-Null

# Surface all output (stdout + errors) from both jobs so CI logs capture everything.
# 2>&1 merges the error stream into stdout so nothing is swallowed.
$jobs | Receive-Job 2>&1 | Write-Output

# Fail if either variant did not complete successfully.
$failed = @($jobs | Where-Object { $_.State -ne "Completed" })
if ($failed.Count -gt 0) {
    # Explicitly surface exception details from each failed job. Receive-Job doesn't always
    # flush these before the script exits, so dump them directly from the child job error list.
    foreach ($job in $failed) {
        foreach ($childJob in $job.ChildJobs) {
            $childJob.Error | ForEach-Object { Write-Error $_ -ErrorAction Continue }
        }
    }
    $names = ($failed | ForEach-Object { $_.Name }) -join ", "
    throw "Safari build failed for variant(s): $names"
}

Write-Output "All Safari builds completed successfully"
