#!/usr/bin/env bash

echo "Running postCreateCommand.sh"

# Configure git safe directory
git config --global --add safe.directory /workspace

# Install mkcert for SSL certificates (needed for WebAuthn)
echo "Installing mkcert..."
sudo apt-get update && sudo apt-get install -y libnss3-tools
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert

# Generate SSL certificates for localhost
echo "Generating SSL certificates..."
mkcert -install
cd /workspace/apps/web
mkcert -cert-file dev-server.local.pem -key-file dev-server.local.pem localhost bitwarden.test
cd /workspace

# Install npm dependencies
echo "Running npm ci..."
npm ci

echo "postCreateCommand.sh completed"
