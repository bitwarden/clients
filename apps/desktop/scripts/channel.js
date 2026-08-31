/// The release channels and the identifiers derived from them.
///
/// CommonJS on purpose: the electron-builder hooks (`after-pack.js`) and the extension build
/// (`build-macos-extension.js`) are CommonJS and `require` this, while the `.mts` build scripts
/// `import` it. One table, both module systems, so an identifier is spelled in exactly one place.

/** @typedef {"stable" | "beta"} Channel */

/** @type {readonly Channel[]} */
const CHANNELS = ["stable", "beta"];

/// Apple developer team, which is what an application identifier and an app group are prefixed
/// with.
const TEAM_ID = "LTZ2PFU5D6";

/// Application identifier per channel. Beta is a separate application -- its own identifier, its
/// own app group and provisioning on macOS.
///
/// electron-builder.beta.json said `com.bitwarden.desktop.beta`, which was a guess that was never
/// registered under that name; `com.bitwarden.beta.desktop` is the identifier beta is actually
/// taking. Changing it means new provisioning profiles and a new app group.
/** @type {Record<Channel, string>} */
const APP_IDS = {
  stable: "com.bitwarden.desktop",
  beta: "com.bitwarden.beta.desktop",
};

/// What the app calls itself. electron-builder uses it for the bundle name, the executable, and
/// every artifact name written as `${productName}`.
/** @type {Record<Channel, string>} */
const PRODUCT_NAMES = {
  stable: "Bitwarden",
  beta: "Bitwarden Beta",
};

/// The App Group the app shares with its autofill extension and its native messaging proxy. Named
/// after the app, not after whichever binary is claiming it.
/**
 * @param {string} appId
 * @returns {string}
 */
function appGroupFor(appId) {
  return `${TEAM_ID}.${appId}`;
}

module.exports = {
  CHANNELS,
  TEAM_ID,
  APP_IDS,
  PRODUCT_NAMES,
  appGroupFor,
};
