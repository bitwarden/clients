#!/usr/bin/env bash
set -euo pipefail

echo "Running design on-create-command.sh"

git config --global --add safe.directory /workspace

# Fix ownership of anonymous volume mount points (created as root by Docker)
sudo chown node:node /workspace/node_modules /workspace/apps/desktop/desktop_native/target

# Packages needed:
#   build-essential, pkg-config, libsecret-1-dev, libglib2.0-dev: native modules built during npm ci
#   chromium: headless browser for the plugin's Storybook screenshots. Debian's chromium ships for
#   both amd64 (Codespaces) and arm64 (local Docker on Apple Silicon); Google Chrome is amd64 only.
sudo apt-get update && sudo apt-get install -y \
    build-essential \
    pkg-config \
    libsecret-1-dev \
    libglib2.0-dev \
    chromium

# chrome-devtools-mcp looks for Chrome at its standard Linux install path
sudo mkdir -p /opt/google/chrome
sudo ln -sf /usr/bin/chromium /opt/google/chrome/chrome

npm ci

# Installed at user scope so the plugin only applies inside this container
claude plugin marketplace add /workspace/.claude/marketplace
claude plugin install design-prototyping@bitwarden-clients

echo "design on-create-command.sh completed"
