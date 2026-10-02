/* eslint-disable @typescript-eslint/no-require-imports */
const { FuseVersion, FuseV1Options } = require("@electron/fuses");

exports.electronFuses = electronFuses;

/**
 * The fuses flipped in the Electron binary for a build on the given platform.
 *
 * @param {NodeJS.Platform} platform The platform the app is packaged for, as `process.platform` names it.
 * @returns {import("@electron/fuses").FuseConfig}
 */
function electronFuses(platform) {
  return {
    version: FuseVersion.V1,
    strictlyRequireAllFuses: true,

    // List of fuses and their default values is available at:
    // https://www.electronjs.org/docs/latest/tutorial/fuses

    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,

    // Currently, asar integrity is only implemented for macOS and Windows
    // https://www.electronjs.org/docs/latest/tutorial/asar-integrity
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]:
      platform == "darwin" || platform == "win32",

    [FuseV1Options.OnlyLoadAppFromAsar]: true,

    // App refuses to open when enabled
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,

    // To disable this, we should stop using the file:// protocol to load the app bundle
    // This can be done by defining a custom app:// protocol and loading the bundle from there,
    // but then any requests to the server will be blocked by CORS policy
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,

    // Enables V8 signal handlers to trap Out of Bounds memory access from WebAssembly
    [FuseV1Options.WasmTrapHandlers]: true,
  };
}
