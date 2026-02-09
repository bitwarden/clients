tell application "System Events"
    repeat with p in (every process whose name is "Electron")
        repeat with w in (every window of p)
            if name of w contains "Bitwarden" then
                set frontmost of p to true
                perform action "AXRaise" of w
                delay 0.3

                click menu bar item "File" of menu bar 1 of p
                delay 0.2
                click menu item "Sync now" of menu "File" of menu bar 1 of p
                delay 0.5

                return
            end if
        end repeat
    end repeat
end tell
