#!/bin/bash
# Opens File -> Import in Bitwarden Desktop

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
osascript "$SCRIPT_DIR/bitwarden-import-from-keeper.applescript"
