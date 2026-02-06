#!/bin/bash
# Import from Keeper with email device approval

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
"$SCRIPT_DIR/bitwarden-import-from-keeper.sh"
sleep 3

osascript "$SCRIPT_DIR/bitwarden-import-from-keeper-email.applescript"
