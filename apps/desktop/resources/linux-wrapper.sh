#!/bin/sh

# disable core dumps
ulimit -c 0

if [ -n "$FLATPAK_ID" ]; then
  echo "Running in Flatpak sandbox with ID: $FLATPAK_ID"
  # Flatpak: run through zypak and preload the process-isolation shim.
  export TMPDIR="$XDG_RUNTIME_DIR/app/$FLATPAK_ID"
  export ZYPAK_LD_PRELOAD="/app/bin/libprocess_isolation.so"
  export PROCESS_ISOLATION_LD_PRELOAD="/app/bin/libprocess_isolation.so"
  APP_PATH="/app/bin"
else
  # might be behind symlink
  RAW_PATH=$(readlink -f "$0")
  APP_PATH=$(dirname $RAW_PATH)

  if [ -n "$SNAP" ]; then
    # force use of base image libdbus in snap
    if [ -e "/usr/lib/x86_64-linux-gnu/libdbus-1.so.3" ]; then
      export LD_PRELOAD="/usr/lib/x86_64-linux-gnu/libdbus-1.so.3"
    fi
  fi
fi

# Honor a DISPLAY_MODE (X11, WAYLAND, or AUTO) provided in the environment.
DISPLAY_MODE_OVERRIDE="$DISPLAY_MODE"

# Detect which display servers are available.
if [ -n "$DISPLAY" ]; then X11_AVAILABLE="true"; else X11_AVAILABLE="false"; fi
if [ -n "$WAYLAND_DISPLAY" ]; then WAYLAND_AVAILABLE="true"; else WAYLAND_AVAILABLE="false"; fi
echo "X11 available: $X11_AVAILABLE"
echo "Wayland available: $WAYLAND_AVAILABLE"

# Only force a platform when exactly one display server is available;
# otherwise let Electron auto-detect.
if [ "$X11_AVAILABLE" = "true" ] && [ "$WAYLAND_AVAILABLE" = "false" ]; then
  DISPLAY_MODE="X11"
elif [ "$WAYLAND_AVAILABLE" = "true" ] && [ "$X11_AVAILABLE" = "false" ]; then
  DISPLAY_MODE="WAYLAND"
else
  DISPLAY_MODE="AUTO"
fi

# An explicit DISPLAY_MODE from the environment always wins.
if [ -n "$DISPLAY_MODE_OVERRIDE" ]; then
  DISPLAY_MODE="$DISPLAY_MODE_OVERRIDE"
fi

echo "Display mode: $DISPLAY_MODE"

case "$DISPLAY_MODE" in
  X11) PARAMS="--enable-features=UseOzonePlatform --ozone-platform=x11" ;;
  WAYLAND) PARAMS="--enable-features=UseOzonePlatform,WaylandWindowDecorations --ozone-platform=wayland" ;;
  # A bug in Electron 39 (which now enables Wayland by default) causes a crash on
  # systems using Wayland with hardware acceleration. Platform decided to
  # configure Electron to use X11 (with an opt-out) until the upstream bug is
  # fixed. The follow-up task is https://bitwarden.atlassian.net/browse/PM-31080.
  AUTO) PARAMS="--enable-features=UseOzonePlatform --ozone-platform=x11" ;;
  *)
    echo "Unknown DISPLAY_MODE '$DISPLAY_MODE', falling back to X11" >&2
    PARAMS="--enable-features=UseOzonePlatform --ozone-platform=x11"
  ;;
esac

if [ -n "$FLATPAK_ID" ]; then
  exec zypak-wrapper "$APP_PATH/bitwarden-app" "$@" $PARAMS
else
  exec "$APP_PATH/bitwarden-app" $PARAMS "$@"
fi
