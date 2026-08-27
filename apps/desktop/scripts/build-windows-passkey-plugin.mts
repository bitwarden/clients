/// Build the Windows passkey plugin.
///
/// Registers Bitwarden with the Windows plugin authenticator API so passkeys can be used from
/// outside the app. Windows only, and it ships alongside two resources the packaging step
/// supplies -- the plugin authenticator config and logo, which differ per release channel.
///
/// Usage:
///   node scripts/build-windows-passkey-plugin.mts --build-dir build-win

import { buildCargoArtifact } from "./cargo-build.mts";

buildCargoArtifact({
  cargoPackage: "windows_plugin_authenticator",
  targetKey: "windowsPasskeyPlugin",
  kind: "binary",
});
