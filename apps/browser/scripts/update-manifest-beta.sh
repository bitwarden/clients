#!/usr/bin/env bash

####
# Update the version in the build directory for the beta channel.
#
# Chrome requires a numeric version, so the beta ordinal becomes a fourth
# component. version_name is Chrome-only and display-only, so it carries the
# standard semver prerelease form (-beta.N) instead.
####

set -e
set -u
set -o pipefail

SCRIPT_ROOT="$(dirname "$0")"
BUILD_DIR="$SCRIPT_ROOT/../build"
MANIFEST_PATH="$BUILD_DIR/manifest.json"

if [[ ! "${BETA_NUMBER:-}" =~ ^[0-9]+$ ]]; then
  echo "ERROR: BETA_NUMBER must be a positive integer, got '${BETA_NUMBER:-}'"
  exit 1
fi

if [ ! -f "$MANIFEST_PATH" ]; then
  echo "ERROR: $MANIFEST_PATH not found, run the build first"
  exit 1
fi

BASE_VERSION=$(jq -r '.version' "$MANIFEST_PATH")

# Guards against stamping an already-stamped manifest, which would compound the
# ordinal into a fourth component that is already there.
if [[ ! "$BASE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: unexpected base version '$BASE_VERSION' in $MANIFEST_PATH, expected three numeric components"
  exit 1
fi

MANIFEST_PATH_TMP="${MANIFEST_PATH}.tmp"

if jq --arg version "$BASE_VERSION.$BETA_NUMBER" \
  --arg version_name "$BASE_VERSION-beta.$BETA_NUMBER" \
  '.version = $version | .version_name = $version_name' \
  "$MANIFEST_PATH" > "$MANIFEST_PATH_TMP"; then
  mv "$MANIFEST_PATH_TMP" "$MANIFEST_PATH"
  echo "Updated version to $BASE_VERSION.$BETA_NUMBER (displayed as $BASE_VERSION-beta.$BETA_NUMBER) in $MANIFEST_PATH"
else
  echo "ERROR: Failed to update manifest with jq"
  rm -f "$MANIFEST_PATH_TMP"
  exit 1
fi
