#!/usr/bin/env bash

####
# Compress the build directory into a zip file.
####

set -e
set -u
set -x
set -o pipefail

FILENAME=$1

SCRIPT_ROOT="$(dirname "$0")"
BUILD_DIR="$SCRIPT_ROOT/build"
DIST_DIR="$SCRIPT_ROOT/dist"

# Create dist directory if it doesn't exist
mkdir -p $DIST_DIR

DIST_PATH="$DIST_DIR/$FILENAME"

rm -f $DIST_PATH

# Compress build directory
if [ -d "$BUILD_DIR" ]; then
  zip -r $DIST_PATH $BUILD_DIR
  echo "Zipped $BUILD_DIR into $DIST_PATH"
fi
