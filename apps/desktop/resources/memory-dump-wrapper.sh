#!/bin/sh

# disable core dumps
ulimit -c 0

APP_PATH=$(dirname "$0")
# pass through all args
$APP_PATH/bitwarden-app "$@"