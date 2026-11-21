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

# ---------------------------------------------------------------------------
# Unattended upgrades must be able to replace a running installation.
#
# electron-builder's built-in running-app check evaluates
#   (Get-CimInstance Win32_Process | ? { ... }).Count -gt 0
# in Windows PowerShell 5.1. When exactly one process matches, the pipeline
# returns a single CimInstance whose .Count is $null, so the check reports
# "not running" and the installer never closes the app. The old uninstaller
# then cannot rename $INSTDIR and aborts, which makes unattended upgrades
# (`winget upgrade Bitwarden.Bitwarden`, Chocolatey, and the in-app updater)
# fail with "Failed to uninstall old application files...: 2".
#
# electron-builder skips its own check when this macro is defined, so define a
# replacement that wraps the pipeline in @() and closes the app on upgrade.
# Upstream report: https://github.com/electron-userland/electron-builder/issues/10454
# ---------------------------------------------------------------------------

!define BW_APP_EXE "bitwarden.exe"

Var BWPowerShellAvailable

# Sets $BWPowerShellAvailable to 1 when the bundled Windows PowerShell can
# enumerate processes.
!macro bwDetectPowerShell
    StrCpy $BWPowerShellAvailable 0
    ${If} ${FileExists} "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe"
        nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "if (Get-Command Get-CimInstance -ErrorAction SilentlyContinue) { exit 7 } else { exit 1 }"`
        Pop $R3
        ${If} $R3 == 7
            StrCpy $BWPowerShellAvailable 1
        ${EndIf}
    ${EndIf}
!macroend

# Sets $R0 to 0 when a process runs from $INSTDIR, or to 1 when none does.
!macro bwFindAppProcess
    Push $R1
    Push $R2
    !insertmacro bwDetectPowerShell
    StrCpy $R0 1
    ${If} $BWPowerShellAvailable == 1
        StrCpy $R1 "$INSTDIR"
        # a single quote delimits the PowerShell string literal, so double it
        ${WordReplace} $R1 "'" "''" "+" $R1
        # @() keeps the result an array, so .Count is 0, 1 or n instead of
        # $null for a single match
        nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "if (@(Get-CimInstance Win32_Process | ? {$$_.Path -and $$_.Path.StartsWith('$R1\', 'CurrentCultureIgnoreCase')}).Count -gt 0) { exit 0 } else { exit 1 }"`
        Pop $R2
        ${If} $R2 == 0
            StrCpy $R0 0
        ${EndIf}
    ${Else}
        # no usable PowerShell: fall back to an image name match for this user
        nsExec::Exec `"$SYSDIR\cmd.exe" /S /C ""$SYSDIR\tasklist.exe" /FI "USERNAME eq %USERNAME%" /FI "IMAGENAME eq ${BW_APP_EXE}" /FO CSV /NH | "$SYSDIR\findstr.exe" /B /I /C:"\"${BW_APP_EXE}\"""`
        Pop $R0
        ${If} $R0 != 0
            StrCpy $R0 1
        ${EndIf}
    ${EndIf}
    Pop $R2
    Pop $R1
!macroend

# Ends every process running from $INSTDIR.
!macro bwCloseAppProcess
    Push $R1
    Push $R2
    !insertmacro bwDetectPowerShell
    DetailPrint `Closing ${PRODUCT_NAME}...`
    ${If} $BWPowerShellAvailable == 1
        StrCpy $R1 "$INSTDIR"
        ${WordReplace} $R1 "'" "''" "+" $R1
        nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process | ? {$$_.Path -and $$_.Path.StartsWith('$R1\', 'CurrentCultureIgnoreCase')} | % { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }"`
        Pop $R2
    ${Else}
        nsExec::Exec `"$SYSDIR\cmd.exe" /S /C ""$SYSDIR\taskkill.exe" /F /IM "${BW_APP_EXE}" /FI "USERNAME eq %USERNAME%""`
        Pop $R2
    ${EndIf}
    Pop $R2
    Pop $R1
!macroend

!macro customCheckAppRunning
    Push $R0
    Push $R1
    Push $R2
    Push $R3
    Push $R4

    !insertmacro bwFindAppProcess
    ${If} $R0 == 0
        ${IfNot} ${isUpdated}
            # interactive install: ask before terminating the app
            MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK bwCloseApp
            Quit
        ${EndIf}

        bwCloseApp:
        !insertmacro bwCloseAppProcess

        # give the processes time to release their files, closing them again if
        # one survives the first attempt
        StrCpy $R4 0
        bwWaitLoop:
            IntOp $R4 $R4 + 1
            Sleep 1000
            !insertmacro bwFindAppProcess
            ${If} $R0 == 0
                ${If} $R4 < 10
                    !insertmacro bwCloseAppProcess
                    Goto bwWaitLoop
                ${EndIf}
                # the app may run elevated, where this process cannot end it
                MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY bwWaitLoop
                SetErrorLevel 2
                Quit
            ${EndIf}
    ${EndIf}

    Pop $R4
    Pop $R3
    Pop $R2
    Pop $R1
    Pop $R0
!macroend
