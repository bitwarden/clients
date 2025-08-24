#!/bin/sh

# disable core dumps
ulimit -c 0

# might be behind symlink
RAW_PATH=$(readlink -f "$0")
APP_PATH=$(dirname $RAW_PATH)

# force use of base image libdbus in snap
if [ -e "/usr/lib/x86_64-linux-gnu/libdbus-1.so.3" ]; then
  export LD_PRELOAD="/usr/lib/x86_64-linux-gnu/libdbus-1.so.3"
fi

# If running in non-snap, add libprocess_isolation.so from app path to LD_PRELOAD
# This prevents debugger / memory dumping on all desktop processes
if [ -z "$SNAP" ] && [ -f "$APP_PATH/libprocess_isolation.so" ]; then
  LIBPROCESS_ISOLATION_SO="$APP_PATH/libprocess_isolation.so"
  LD_PRELOAD="$LIBPROCESS_ISOLATION_SO${LD_PRELOAD:+:$LD_PRELOAD}"
  export LD_PRELOAD
fi

PARAMS="--enable-features=UseOzonePlatform,WaylandWindowDecorations --ozone-platform-hint=auto"
if [ "$USE_X11" = "true" ]; then
  PARAMS=""
fi

$APP_PATH/bitwarden-app $PARAMS "$@"
