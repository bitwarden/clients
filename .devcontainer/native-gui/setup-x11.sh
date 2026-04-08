#!/bin/bash
# Generates docker-compose.override.yml for X11 forwarding
# Detects Windows (WSL2) vs native Linux

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OVERRIDE_FILE="$SCRIPT_DIR/docker-compose.override.yml"

if grep -qi microsoft /proc/version 2>/dev/null; then
    echo "Detected Windows (WSL2) - configuring WSLg..."
    cat > "$OVERRIDE_FILE" << 'EOF'
services:
  bitwarden_clients:
    volumes:
      - /tmp/.X11-unix:/tmp/.X11-unix
      - /mnt/wslg:/mnt/wslg
    environment:
      - DISPLAY=${DISPLAY:-:0}
      - WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-wayland-0}
      - XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/mnt/wslg/runtime-dir}
      - PULSE_SERVER=${PULSE_SERVER:-/mnt/wslg/PulseServer}
EOF
else
    echo "Detected Linux - configuring X11..."
    cat > "$OVERRIDE_FILE" << 'EOF'
services:
  bitwarden_clients:
    volumes:
      - /tmp/.X11-unix:/tmp/.X11-unix
    environment:
      - DISPLAY=${DISPLAY:-:0}
EOF
fi
