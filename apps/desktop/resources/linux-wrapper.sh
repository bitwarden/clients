#!/bin/sh

# disable core dumps
ulimit -c 0

# might be behind symlink
RAW_PATH=$(readlink -f "$0")
APP_PATH=$(dirname $RAW_PATH)

# force use of base image libdus in snap
if [ -e "/usr/lib/x86_64-linux-gnu/libdbus-1.so.3" ]
then
  export LD_PRELOAD="/usr/lib/x86_64-linux-gnu/libdbus-1.so.3"
fi

PARAMS="--enable-features=UseOzonePlatform,WaylandWindowDecorations --ozone-platform-hint=auto"
if [ "$USE_X11" = "true" ]; then
  PARAMS=""
fi

$APP_PATH/bitwarden-app $PARAMS "$@"
