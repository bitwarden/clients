$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

$env:ELECTRON_BUILDER_SIGN_CERT = "C:\temp\code-signing.pfx"
$env:ELECTRON_BUILDER_SIGN_CERT_PW = "1234"
$bwFolder = "$env:LOCALAPPDATA\Packages\bitwardendesktop_h4e712dmw3xyy"

$package = (Get-AppxPackage -name bitwardendesktop)
$appx = ".\dist\Bitwarden-2025.10.2-arm64.appx"
$backupDataFile = "C:\temp\bw-data.json"
$comLogFile = "C:\temp\bitwarden_com_debug.log"

# Build Appx
npm run build-native && npm run build:dev && npm run pack:win:appx:arm64

# Backup tokens
# Copy-Item -Path "$bwFolder\LocalCache\Roaming\Bitwarden\data.json" -Destination $backupDataFile

# Reinstall Appx
Remove-AppxPackage $package && Add-AppxPackage $appx

# Delete log files
Remove-Item -Path $comLogFile

# Restore tokens
# New-Item -Type Directory -Force -Path "$bwFolder\LocalCache\Roaming\Bitwarden\"
# Copy-Item -Path $backupDataFile -Destination "$bwFolder\LocalCache\Roaming\Bitwarden\data.json"
