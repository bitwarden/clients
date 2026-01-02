#!/usr/bin/env bash

cd "$(dirname "$0")"

if [ -d "BitwardenMacosProviderFFI.xcframework" ]; then
  rm -r "BitwardenMacosProviderFFI.xcframework"
fi
if [ -d "tmp" ]; then
  rm -r "tmp"
fi

mkdir -p ./tmp/target/universal-darwin/release/


rustup target add aarch64-apple-darwin
rustup target add x86_64-apple-darwin

cargo build --package autofill_provider --target aarch64-apple-darwin --release
cargo build --package autofill_provider --target x86_64-apple-darwin --release

# Create universal libraries
lipo -create ../target/aarch64-apple-darwin/release/libautofill_provider.a \
  ../target/x86_64-apple-darwin/release/libautofill_provider.a \
  -output ./tmp/target/universal-darwin/release/libautofill_provider.a

# Generate swift bindings
cargo run --bin uniffi-bindgen --features uniffi/cli generate \
  ../target/aarch64-apple-darwin/release/libautofill_provider.dylib \
  --library \
  --language swift \
  --no-format \
  --out-dir tmp/bindings

# Move generated swift bindings
mkdir -p ../../macos/autofill-extension/
mv ./tmp/bindings/*.swift ../../macos/autofill-extension/

# Massage the generated files to fit xcframework
mkdir tmp/Headers
mv ./tmp/bindings/*.h ./tmp/Headers/
cat ./tmp/bindings/*.modulemap > ./tmp/Headers/module.modulemap

# Build xcframework
xcodebuild -create-xcframework \
  -library ./tmp/target/universal-darwin/release/libautofill_provider.a \
  -headers ./tmp/Headers \
  -output ./BitwardenMacosProviderFFI.xcframework

# Cleanup temporary files
rm -r tmp
