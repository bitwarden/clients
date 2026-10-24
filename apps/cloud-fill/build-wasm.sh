#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/wasm-remote"
cargo +1.93 build --target wasm32-unknown-unknown --release
wasm-bindgen --target web --out-dir pkg \
  target/wasm32-unknown-unknown/release/cloud_fill_remote_wasm.wasm
