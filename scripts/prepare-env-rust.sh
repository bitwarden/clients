#!/usr/bin/env bash
set -euo pipefail

# This script prepares the environment for developing in Rust for the clients repo,
# specifically Desktop Native. This script is used by both developers locally, and
# in CI.
#
# NOTE: The cargo tools installed in this script, are installed to the default location
# (user's $HOME dir). If you prefer another location, please install the vesrions
# specified below, and ensure they are in your $PATH.


CARGO_DENY_VERSION="0.18.6"
CARGO_SORT_VERSION="2.0.2"
CARGO_UDEPS_VERSION="0.1.57"

# Ensures the active toolchain is installed, and that nightly is installed
# for the cargo tools
toolchain_is_installed() {
  if ! command -v rustup >/dev/null 2>&1; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
  fi

  # Ensure cargo/rustup are on PATH
  if [ -f "${HOME}/.cargo/env" ]; then
    source "${HOME}/.cargo/env"
  fi

  # Determine desired toolchain and ensure it's installed.
  ACTIVE_TOOLCHAIN="$(cd apps/desktop/desktop_native && rustup show active-toolchain 2>/dev/null || true)"
  ACTIVE_TOOLCHAIN="${ACTIVE_TOOLCHAIN%% *}"  # keep only the first token
  if [ -z "${ACTIVE_TOOLCHAIN}" ]; then
    # No active toolchain yet: fall back to env override or default to stable.
    ACTIVE_TOOLCHAIN="${RUSTUP_TOOLCHAIN:-stable}"
    rustup default "${ACTIVE_TOOLCHAIN}"
  fi

  # For building desktop_native
  rustup toolchain install "${ACTIVE_TOOLCHAIN}"

  # For the cargo tools used in pre-commit hooks and CI
  rustup toolchain install nightly

  rustup show
  echo
}

# Checks version of tool and installs if needed
# Usage: maybe_install_cargo_tool <tool-name> <version>
# Note: cargo-* tools are invoked as "cargo <subcommand>", not as direct binaries
maybe_install_cargo_tool() {
  local tool="$1"
  local version="$2"
  local version_cmd="cargo ${tool#cargo-}"
  local version_pattern="${3:-${tool} ${version}}"

  if ! $version_cmd --version 2>/dev/null | grep -q "^${version_pattern}"; then
    echo "$tool $version is not installed. Installing ..."
    cargo install "$tool" --version "$version" --force --locked
  else
    echo "$tool $version is already installed."
  fi
}

toolchain_is_installed

maybe_install_cargo_tool cargo-deny "${CARGO_DENY_VERSION}"
maybe_install_cargo_tool cargo-sort "${CARGO_SORT_VERSION}"
maybe_install_cargo_tool cargo-udeps "${CARGO_UDEPS_VERSION}"
