#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
DATA_DIR="$SCRIPT_DIR/data"

mkdir -p "$DATA_DIR"

# Delete existing files in the data directory
rm -f "$DATA_DIR"/*

# Fetch and split the phishing domains list into 4MB chunks with .txt extension, no intermediate file
curl -L "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt" \
  | gsplit -b 4m - "$DATA_DIR/phishing-domains-part-" --additional-suffix=.txt

# Fetch the checksum
CHECKSUM=$(curl -sL "https://raw.githubusercontent.com/Phishing-Database/checksums/refs/heads/master/phishing-domains-ACTIVE.txt.md5" | tr -d '\n')

# Generate a JSON file including the checksum field, with paths relative to the data directory
ls "$DATA_DIR"/phishing-domains-part-*.txt \
  | sed "s|$DATA_DIR/||" \
  | jq -R . | jq -s --arg checksum "$CHECKSUM" '{ files: ., checksum: $checksum }' \
  > "$DATA_DIR/local-phishing-meta.json"
