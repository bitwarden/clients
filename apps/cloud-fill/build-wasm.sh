#!/bin/bash
# Builds the RemoteClient wasm module into wasm-remote/pkg.
# Needs: rust 1.93 with the wasm32-unknown-unknown target, and wasm-bindgen-cli matching the
# wasm-bindgen version in wasm-remote/Cargo.lock (cargo install wasm-bindgen-cli --version 0.2.114).
set -euo pipefail
cd "$(dirname "$0")/wasm-remote"
cargo +1.93 build --target wasm32-unknown-unknown --release
wasm-bindgen --target web --out-dir pkg \
  target/wasm32-unknown-unknown/release/cloud_fill_remote_wasm.wasm
