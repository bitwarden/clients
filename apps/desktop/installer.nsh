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
    ${endIf}
!macroend
