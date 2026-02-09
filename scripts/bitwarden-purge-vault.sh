#!/bin/bash

# Purges all ciphers from the Bitwarden vault.
# Stores/refreshes the access token automatically.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN_FILE="$SCRIPT_DIR/bitwarden-token.json"
MASTER_PASSWORD_HASH="EeT1Z5Jdy/fDV4BOIhOAFgBuHibjnlEoWLJDLxlnY/Y="

refresh_token() {
    local refresh_token
    refresh_token=$(jq -r '.refresh_token' "$TOKEN_FILE")

    echo "Refreshing access token..."
    local response
    response=$(curl -s "https://vault.bitwarden.com/identity/connect/token" \
        -H "accept: application/json" \
        -H "bitwarden-client-name: web" \
        -H "bitwarden-client-version: 2026.1.1" \
        -H "content-type: application/x-www-form-urlencoded; charset=utf-8" \
        -H "device-type: 9" \
        -d "grant_type=refresh_token&client_id=web&refresh_token=$refresh_token")

    if echo "$response" | jq -e '.access_token' > /dev/null 2>&1; then
        echo "$response" > "$TOKEN_FILE"
        echo "Token refreshed."
    else
        echo "Failed to refresh token:"
        echo "$response"
        exit 1
    fi
}

purge_vault() {
    local access_token
    access_token=$(jq -r '.access_token' "$TOKEN_FILE")

    echo "Purging vault..."
    local http_code
    http_code=$(curl -s -o /dev/stderr -w "%{http_code}" \
        "https://vault.bitwarden.com/api/ciphers/purge" \
        -X POST \
        -H "authorization: Bearer $access_token" \
        -H "bitwarden-client-name: web" \
        -H "bitwarden-client-version: 2026.1.1" \
        -H "content-type: application/json; charset=utf-8" \
        -H "device-type: 9" \
        -d "{\"masterPasswordHash\":\"$MASTER_PASSWORD_HASH\"}" 2>&1)

    echo "$http_code"
}

if [ ! -f "$TOKEN_FILE" ]; then
    echo "No token file found at $TOKEN_FILE"
    echo "Create it with initial token data first."
    exit 1
fi

result=$(purge_vault)

if echo "$result" | grep -q "^401\|^403"; then
    refresh_token
    result=$(purge_vault)
fi

if echo "$result" | grep -q "^200\|^204"; then
    echo "Vault purged successfully."
    echo "Syncing desktop app..."
    osascript "$SCRIPT_DIR/bitwarden-sync-now.applescript"
    echo "Sync triggered."
else
    echo "Purge may have failed. Response: $result"
fi
