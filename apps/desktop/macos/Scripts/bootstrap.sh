#!/bin/bash
set -euo pipefail

echo "Bootstrapping macOS autofill extension..."

# Handle script being called from repo root or Scripts folder
script_dir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
workspace_root=$(dirname "$script_dir")

if [ $# -eq 0 ]; then
    echo "❌ build dir must be specified."
    echo "Usage:"
    echo "  $0 <build_dir>"
    exit 1
fi

build_dir=$(realpath $1)

if [ ! -d $build_dir ]; then
    echo "Build directory could not be found: $build_dir"
    exit 1
fi

build_config_file="${build_dir}/build-config.json"
export BITWARDEN_BUILD_DIR=$build_dir
export ARCHS=$(cat "$build_config_file" | jq .derived.macos.ARCHS -r)
export LIBRARY_IDENTIFIER=$(cat "$build_config_file" | jq .derived.macos.libraryIdentifier -r)
export BITWARDEN_APPLE_TEAM_ID=$(cat "$build_config_file" | jq .macos.teamId -r)
export BITWARDEN_PRODUCT_NAME=$(cat "$build_config_file" | jq .derived.productName -r)
# We populate the provisioning profile for developer convenience in Xcode using
# just the first provisioning profile, but the build script will produce an
# artifact using each of the provisioning profiles specified in the config.
export BITWARDEN_PROVISIONING_PROFILE_SPECIFIER=$(cat "$build_config_file" | jq .derived.macos.autofillExtensionProvisioningProfile -r)
signing_cert=$(cat "$build_config_file" | jq .macos.signingCertificate -r)
if [[ "$signing_cert" = "null" ]]; then
  export BITWARDEN_CODE_SIGN_IDENTITY=""
else
  export BITWARDEN_CODE_SIGN_IDENTITY=$signing_cert
fi
export BITWARDEN_AUTOFILL_EXTENSION_APP_ID=$(cat "$build_config_file" | jq .derived.macos.autofillExtensionAppId -r)
export BITWARDEN_PRIVATE_DIR="$build_dir/apps/desktop/macos/BitwardenMacosAutofillProvider"
export DESKTOP_PROJECT_DIR=$(realpath "$workspace_root/..")

if ! brew bundle check --no-upgrade --verbose; then
    echo "❌ ❌ ❌ ❌ ❌ ❌"
    echo
fi

export NODE_BIN=$(cat $build_dir/build-config.json | jq '.toolchains.node.bin' -r)
node_version=$(cat $build_dir/build-config.json | jq '.toolchains.node.version' -r)

if [ -z "${NODE_BIN:-}" ]; then
    echo "❌ Path to Node binary could not be found. Make sure it is set in the config file's `toolchains.node.bin` key."
    exit 1
fi

export CARGO_BIN=$(cat $build_dir/build-config.json | jq '.toolchains.cargo.bin' -r)
cargo_version=$(cat $build_dir/build-config.json | jq '.toolchains.cargo.version' -r)

if [ -z "${CARGO_BIN:-}" ]; then
    echo "❌ Path to Cargo binary could not be found. Make sure it is set in the config file's `toolchains.cargo.bin` key."
    exit 1
fi
mint bootstrap
mint run xcodegen --spec $workspace_root/project-autofill-extension.yml

xcode_line=$(xcodebuild -version 2>/dev/null || system_profiler SPDeveloperToolsDataType | grep "Xcode:")
xcode_version=$(echo "$xcode_line" | head -n 1 | awk '{print $2}')

# Write Xcode settings
mkdir -p "${workspace_root}/Settings"


cat > "${workspace_root}/Settings/WorkspaceSettings.xcsettings" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://apple.com">
<plist version="1.0">
<dict>
	<key>IDEWorkspaceSharedSettings_DerivedDataLocationStyle</key>
	<integer>2</integer>
	<key>IDEWorkspaceSharedSettings_DerivedDataCustomLocation</key>
	<string>${BITWARDEN_BUILD_DIR}/apps/desktop/macos/BitwardenAutofillExtension.p</string>
</dict>
</plist>
EOF

# TODO: this is used in multiple build scripts. Derive this at config time and just read it from the config instead.
echo "✅ Bootstrapped BitwardenAutofillExtension Xcode project!"
echo "Current Xcode version: $xcode_version"
echo "Current Node version: $node_version"
echo "Current Cargo version: $cargo_version"
echo "Build directory: $build_dir"
