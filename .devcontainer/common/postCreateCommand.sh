#!/usr/bin/env bash

echo "Running postCreateCommand.sh"

# Load configuration (use .env.example as fallback for defaults)
if [ -f ".devcontainer/common/.env" ]; then
    source .devcontainer/common/.env
else
    source .devcontainer/common/.env.example
fi

# Configure git safe directory
git config --global --add safe.directory /workspace

echo "Installing system dependencies..."
# Packages needed:
#   libnss3-tools: mkcert certificate installation
#   build-essential, pkg-config: native module compilation
#   libsecret-1-dev, libglib2.0-dev: desktop native module dependencies
#   Remaining packages: Electron runtime dependencies
sudo apt-get update && sudo apt-get install -y \
    libnss3-tools \
    build-essential \
    pkg-config \
    libsecret-1-dev \
    libglib2.0-dev \
    libdbus-1-3 \
    libgtk-3-0 \
    libnss3 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxtst6 \
    libxss1 \
    libasound2 \
    libgbm1

if [ "$SETUP_DESKTOP_NATIVE" = "yes" ]; then
    # Install Rust nightly toolchain (required for desktop native module)
    echo "Installing Rust nightly toolchain..."
    rustup toolchain install nightly

    # Install cargo tools for pre-commit hooks (optional but recommended)
    echo "Installing cargo tools for pre-commit hooks..."
    cargo install cargo-sort cargo-udeps cargo-deny
fi

if [ "$SETUP_MKCERT" = "yes" ]; then
    # Install mkcert for SSL certificates (needed for WebAuthn)
    echo "Installing mkcert..."
    curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
    chmod +x mkcert-v*-linux-amd64
    sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert

    # Generate SSL certificates for localhost
    echo "Generating SSL certificates..."
    mkcert -install
    cd /workspace/apps/web
    mkcert -cert-file dev-server.local.pem -key-file dev-server.local.pem localhost bitwarden.test
    cd /workspace
fi

if [ "$RUN_NPM_CI" = "yes" ]; then
    # Install npm dependencies
    echo "Running npm ci..."
    npm ci
fi

echo "postCreateCommand.sh completed"
