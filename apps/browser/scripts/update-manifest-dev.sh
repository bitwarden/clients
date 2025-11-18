#!/usr/bin/env bash

####
# Update the manifest key in the build directory.
####

set -e
set -u
set -x
set -o pipefail

SCRIPT_ROOT="$(dirname "$0")"
BUILD_DIR="$SCRIPT_ROOT/../build"

# Check if build directory exists
if [ -d "$BUILD_DIR" ]; then
  cd $BUILD_DIR

  # Update manifest with dev public key
  MANIFEST_PATH="./manifest.json"

  # Generated arbitrary public key from Chrome Dev Console to pin side-loaded extension IDs during development
  DEV_PUBLIC_KEY='MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuIvjtsAVWZM0i5jFhSZcrmwgaf3KWcxM5F16LNDNeivC1EqJ+H5xNZ5R9UN5ueHA2xyyYAOlxY07OcY6CKTGJRJyefbUhszb66sdx26SV5gVkCois99fKBlsbSbd6und/BJYmoFUWvFCNNVH+OxLMqMQWjMMhM2ItLqTYi7dxRE5qd+7LwQpnGG2vTkm/O7nu8U3CtkfcIAGLsiTd7/iuytcMDnC0qFM5tJyY/5I+9QOhpUJ7Ybj3C18BDWDORhqxutWv+MSw//SgUn2/lPQrnrKq7FIVQL7FxxEPqkv4QwFvaixps1cBbMdJ1Ygit1z5JldoSyNxzCa5vVcJLecMQIDAQAB'

  jq --arg key "$DEV_PUBLIC_KEY" '.key = $key' "$MANIFEST_PATH" > "${MANIFEST_PATH}.tmp" && mv "${MANIFEST_PATH}.tmp" "$MANIFEST_PATH"
  echo "Updated manifest key in $MANIFEST_PATH"
fi
