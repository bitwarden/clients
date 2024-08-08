#!/bin/sh

# disable core dumps
ulimit -c 0

# might be behind symlink
RAW_PATH=$(readlink -f "$0")
APP_PATH=$(dirname $RAW_PATH)

# pass through all args
$APP_PATH/bitwarden-app "$@"

