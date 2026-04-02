!macro customInit
    ${if} $installMode == "all"
        ${IfNot} ${UAC_IsAdmin}
            ShowWindow $HWNDPARENT ${SW_HIDE}
            !insertmacro UAC_RunElevated
            Quit
        ${endif}
    ${endif}
!macroend

# When the user is uninstalling the app, remove the auto-start registry entries
!macro customUnInstall
    ${ifNot} ${isUpdated}
        DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.${PRODUCT_NAME}"
        DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.${PRODUCT_NAME}"

        DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "electron.app.${PRODUCT_NAME}"
        DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "electron.app.${PRODUCT_NAME}"

        ; Clean up Explorer context menu entries (legacy)
        DeleteRegKey HKCU "Software\Classes\*\shell\Bitwarden"
        DeleteRegKey HKCU "Software\Classes\Directory\shell\Bitwarden"

        ; Remove sparse package for Win11 modern context menu (best-effort)
        nsExec::ExecToLog 'powershell -Command "Get-AppxPackage 8bitSolutionsLLC.BitwardenDesktopShellExtension* | Remove-AppxPackage" '

        ; Clean up shell extension registry
        DeleteRegKey HKCU "Software\Bitwarden"
    ${endIf}
!macroend
