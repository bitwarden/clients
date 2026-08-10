/* eslint-disable @typescript-eslint/no-require-imports, no-console */
/**
 * Point the Appx COM server at the beta passkey provider's class ID.
 *
 * custom-appx-manifest.xml is shared by both channels and carries the stable class ID.
 * electron-builder substitutes only its own manifest macros, so the beta class ID is
 * swapped in here, from the same config files the app itself is packaged with.
 *
 * The declared class ID has to match the one the beta app registers with Windows at
 * runtime, or activating the beta provider finds nothing to launch. Leaving the stable
 * class ID in place is worse than a no-op: the beta package would declare the stable
 * app's COM class, so whichever installed last would answer for it.
 *
 * Registered as `appxManifestCreated` from electron-builder.beta.json only, which is what
 * scopes it to beta builds. electron-builder calls it after writing the manifest and
 * before makeappx packs it.
 */
const fs = require("fs");
const path = require("path");

const configDir = path.resolve(__dirname, "../resources");

function readClsid(configFile) {
  const configPath = path.join(configDir, configFile);
  const { clsid } = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!clsid) {
    throw new Error(`No plugin authenticator clsid found in ${configPath}`);
  }
  return clsid;
}

exports.default = function (manifestPath) {
  const stableClsid = readClsid("windows_plugin_authenticator_config.json");
  const betaClsid = readClsid("windows_plugin_authenticator_config.beta.json");
  if (stableClsid === betaClsid) {
    throw new Error(
      `The beta plugin authenticator clsid must differ from the stable one, got ${betaClsid} for both.`,
    );
  }

  const manifest = fs.readFileSync(manifestPath, "utf8");
  if (!manifest.includes(stableClsid)) {
    throw new Error(
      `Expected the stable plugin authenticator clsid ${stableClsid} in ${manifestPath}. ` +
        `Check that appx.customManifestPath points at a manifest declaring the COM server.`,
    );
  }

  fs.writeFileSync(manifestPath, manifest.replaceAll(stableClsid, betaClsid));
  console.log(`[*] Set beta plugin authenticator clsid ${betaClsid} in ${manifestPath}`);
};
