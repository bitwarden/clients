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
BUILD_DIR="$SCRIPT_ROOT/../build"

# Check if build directory exists
if [ -d "$BUILD_DIR" ]; then
  cd $BUILD_DIR
  
  # Create dist directory if it doesn't exist
  DIST_DIR="../dist"
  mkdir -p $DIST_DIR

  # Remove existing dist zip file
  DIST_PATH="$DIST_DIR/$FILENAME"
  rm -f $DIST_PATH

  # Compress build directory
  zip -r $DIST_PATH ./
  echo "Zipped $BUILD_DIR into $DIST_PATH"
fi
