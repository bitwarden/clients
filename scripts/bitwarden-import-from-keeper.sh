#!/bin/bash
# Opens File -> Import in Bitwarden Desktop

osascript -e '
tell application "System Events"
    repeat with p in (every process whose name is "Electron")
        repeat with w in (every window of p)
            if name of w contains "Bitwarden" then
                set frontmost of p to true
                perform action "AXRaise" of w
                delay 0.3

                -- Press escape to close any open dialog
                key code 53 -- escape
                delay 0.2

                click menu bar item "File" of menu bar 1 of p
                delay 0.2
                click menu item "Import" of menu "File" of menu bar 1 of p
                delay 0.5

                -- Send 4 tabs to navigate to the right field
                keystroke tab
                delay 0.1
                keystroke tab
                delay 0.1
                keystroke tab
                delay 0.1
                keystroke tab
                delay 0.1

                -- Type "keeper"
                keystroke "keeper"
                delay 0.2

                -- Press down arrow and enter
                key code 125 -- down arrow
                delay 0.1
                keystroke return
                delay 0.3

                -- Send 3 tabs
                keystroke tab
                delay 0.1
                keystroke tab
                delay 0.1
                keystroke tab
                delay 0.1

                -- Type email and press enter
                keystroke "lastpass.ruby+22-january-2026@gmail.com"
                delay 0.2
                keystroke return
                delay 0.3

                -- Send 2 tabs
                keystroke tab
                delay 0.1
                keystroke tab
                delay 0.1

                -- Type password and press enter
                keystroke "what'"'"'s a password?"
                delay 0.2
                keystroke return
                return
            end if
        end repeat
    end repeat
end tell
'
