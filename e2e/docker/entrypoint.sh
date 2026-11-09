#!/usr/bin/env bash
# Runs inside the e2e container (see isolate.mjs): installs Linux dependencies into the
# cached volumes, then runs the npm script under a virtual X display.
#
#   entrypoint.sh <npm script> [args...]
set -euo pipefail

# Marks which lockfile the node_modules volume was installed from.
LOCK_MARKER=node_modules/.e2e-docker-lock.sha256

lock_hash="$(sha256sum package-lock.json | cut -d' ' -f1)"

# npm ci wipes node_modules, so only run it when the lockfile changed.
if [[ "$(cat "$LOCK_MARKER" 2>/dev/null)" != "$lock_hash" ]]; then
  npm ci
  echo "$lock_hash" > "$LOCK_MARKER"
fi

# No-op once the browser is in the cached volume.
npx --workspace @bitwarden/e2e playwright install chromium

script="$1"
shift

exec xvfb-run -a npm run "$script" -- "$@"
