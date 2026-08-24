/* eslint-disable @typescript-eslint/no-require-imports, no-console */
require("dotenv").config();
const child_process = require("child_process");
const path = require("path");

const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");
const builder = require("electron-builder");
const fse = require("fs-extra");

const { channelForAppId } = require("./channel.js");

exports.default = run;

/// Where a build's entitlements live.
///
/// Beta generates them at pack time from the application identifier it is being built with, so its
/// App Group follows its bundle identifier instead of naming stable's. Stable still signs with the
/// checked-in plists, which scripts/entitlements.spec.ts pins to the generator's output byte for
/// byte -- its build path deliberately does not change here, because it ships first. Both channels
/// converge once the generator drives all of them.
///
/// @param {"stable" | "beta"} channel
/// @param {string} generated file name under intermediates/entitlements
/// @param {string} checkedIn file name under resources
/// @returns {string}
function entitlementsPath(channel, generated, checkedIn) {
  return channel === "beta"
    ? path.join(__dirname, "..", "intermediates", "entitlements", generated)
    : path.join(__dirname, "..", "resources", checkedIn);
}

/**
 *
 * @param {builder.AfterPackContext} context
 */
async function run(context) {
  console.log("## After pack");
  // console.log(context);

  if (context.packager.platform.nodeName !== "darwin" || context.arch === builder.Arch.universal) {
    await addElectronFuses(context);
  }

  if (context.electronPlatformName === "linux") {
    console.log("Creating memory-protection wrapper script");
    const appOutDir = context.appOutDir;
    const oldBin = path.join(appOutDir, context.packager.executableName);
    const newBin = path.join(appOutDir, "bitwarden-app");
    fse.moveSync(oldBin, newBin);
    console.log("Moved binary to bitwarden-app");

    const wrapperScript = path.join(__dirname, "../resources/linux-wrapper.sh");
    const wrapperBin = path.join(appOutDir, context.packager.executableName);
    fse.copyFileSync(wrapperScript, wrapperBin);
    fse.chmodSync(wrapperBin, "755");
    console.log("Copied memory-protection wrapper script");
  }

  // The autofill extension is copied in here, before electron-builder signs the app, so that
  // the app's own signature seals it. Copying it in after signing leaves the outer bundle
  // invalid ("a sealed resource is missing or invalid") and notarization rejects it unless the
  // whole package is signed a second time. electron-builder never signs anything under
  // Contents/PlugIns, so the extension keeps the signature and entitlements Xcode gave it.
  const isMasDevBuild =
    context.electronPlatformName === "mas" && context.targets.at(0)?.name === "mas-dev";
  if (context.electronPlatformName === "darwin" || isMasDevBuild) {
    console.log("### Copying autofill extension");
    // cannot use extraFiles because it modifies the extension's .plist and makes it invalid
    const extensionPath = path.join(__dirname, "../macos/dist/autofill-extension.appex");
    if (!fse.existsSync(extensionPath)) {
      console.log("### Autofill extension not found - skipping");
    } else {
      const appName = context.packager.appInfo.productFilename;
      const plugInsPath = path.join(context.appOutDir, `${appName}.app`, "Contents/PlugIns");
      fse.mkdirSync(plugInsPath, { recursive: true });
      fse.copySync(extensionPath, path.join(plugInsPath, "autofill-extension.appex"));
    }
  }

  // The Safari extension is copied in here for the same reason as the autofill extension: it
  // has to be present before electron-builder signs the app. It used to be copied in from the
  // afterSign hook, which invalidated the app's seal and forced a second signing pass over the
  // whole package to repair it.
  if (["darwin", "mas"].includes(context.electronPlatformName)) {
    console.log("### Copying safari extension");
    // Copy Safari plugin to work-around https://github.com/electron-userland/electron-builder/issues/5552
    const plugIn = path.join(__dirname, "../PlugIns");
    if (!fse.existsSync(plugIn)) {
      console.log("### Safari extension not found - skipping");
    } else {
      const appName = context.packager.appInfo.productFilename;
      const plugInsPath = path.join(context.appOutDir, `${appName}.app`, "Contents/PlugIns");
      fse.mkdirSync(plugInsPath, { recursive: true });
      fse.copySync(path.join(plugIn, "safari.appex"), path.join(plugInsPath, "safari.appex"));
    }
  }

  if (["darwin", "mas"].includes(context.electronPlatformName)) {
    const is_mas = context.electronPlatformName === "mas";

    let id;

    // Only use the Bitwarden Identities on CI
    if (process.env.GITHUB_ACTIONS === "true") {
      if (is_mas) {
        id = "3rd Party Mac Developer Application: Bitwarden Inc";
      } else {
        id = "Developer ID Application: Bitwarden Inc";
      }
      // Locally, use the first valid code signing identity, unless CSC_NAME is set
    } else if (process.env.CSC_NAME) {
      id = process.env.CSC_NAME;
    } else {
      const identities = getIdentities();
      if (identities.length === 0) {
        throw new Error("No valid identities found");
      }
      id = identities[0].id;
    }

    console.log(
      `Signing proxy binary before the main bundle, using identity '${id}', for build ${context.electronPlatformName}`,
    );

    const appName = context.packager.appInfo.productFilename;
    const appPath = `${context.appOutDir}/${appName}.app`;
    const proxyPath = path.join(appPath, "Contents", "MacOS", "desktop_proxy");
    const inheritProxyPath = path.join(appPath, "Contents", "MacOS", "desktop_proxy.inherit");

    const packageId = context.packager.appInfo.id;

    // The proxy is scoped to the App Group it shares with the app, and that group is named after
    // the app, so its entitlements have to follow the identifier actually being built. Resolved
    // from the identifier rather than by testing for a suffix: `com.bitwarden.beta.desktop` does
    // not end in `.beta`, and an identifier that is not one of ours should fail loudly.
    const channel = channelForAppId(packageId);

    // Sandbox the proxy and scope it to the App Group on Developer ID builds as well as App Store
    // ones, so both reach the same shared container the app listens on. Without the group the
    // proxy resolves its socket to its own cache directory, which the app cannot see.
    const proxyEntitlements = entitlementsPath(
      channel,
      "desktop-proxy.plist",
      "entitlements.desktop_proxy.plist",
    );
    child_process.execSync(
      `codesign -s '${id}' -i ${packageId} -f --timestamp --options runtime --entitlements "${proxyEntitlements}" "${proxyPath}"`,
    );

    if (is_mas) {
      // The App Store build spawns the inherit helper as a child of the sandboxed app, so it
      // takes the host's sandbox -- and its App Group membership -- through the inherit
      // entitlement rather than naming the group itself.
      const inheritEntitlements = entitlementsPath(
        channel,
        "desktop-proxy-inherit.plist",
        "entitlements.desktop_proxy.inherit.plist",
      );
      child_process.execSync(
        `codesign -s '${id}' -i ${packageId} -f --timestamp --options runtime --entitlements "${inheritEntitlements}" "${inheritProxyPath}"`,
      );
    } else {
      // For non-Appstore builds, we don't need the inherit binary as they are not sandboxed,
      // but we sign and include it anyway for consistency. It should be removed once DDG supports the proxy directly.
      const inheritEntitlements = entitlementsPath(
        channel,
        "app-inherit.plist",
        "entitlements.mac.inherit.plist",
      );
      child_process.execSync(
        `codesign -s '${id}' -i ${packageId} -f --timestamp --options runtime --entitlements "${inheritEntitlements}" "${inheritProxyPath}"`,
      );
    }
  }
}

// Partially based on electron-builder code:
// https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/macPackager.ts
// https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/codeSign/macCodeSign.ts

const appleCertificatePrefixes = [
  "Developer ID Application:",
  // "Developer ID Installer:",
  // "3rd Party Mac Developer Application:",
  // "3rd Party Mac Developer Installer:",
  "Apple Development:",
];

function getIdentities() {
  const ids = child_process
    .execSync("/usr/bin/security find-identity -v -p codesigning")
    .toString();

  return ids
    .split("\n")
    .filter((line) => {
      for (const prefix of appleCertificatePrefixes) {
        if (line.includes(prefix)) {
          return true;
        }
      }
      return false;
    })
    .map((line) => {
      const split = line.trim().split(" ");
      const id = split[1];
      const name = split.slice(2).join(" ").replace(/"/g, "");
      return { id, name };
    });
}

/**
 * @param {import("electron-builder").AfterPackContext} context
 */
async function addElectronFuses(context) {
  const platform = context.packager.platform.nodeName;

  const ext = {
    darwin: ".app",
    win32: ".exe",
    linux: "",
  }[platform];

  const IS_LINUX = platform === "linux";
  const executableName = IS_LINUX
    ? context.packager.appInfo.productFilename.toLowerCase().replace("-dev", "").replace(" ", "-")
    : context.packager.appInfo.productFilename; // .toLowerCase() to accommodate Linux file named `name` but productFileName is `Name` -- Replaces '-dev' because on Linux the executable name is `name` even for the DEV builds

  const electronBinaryPath = path.join(context.appOutDir, `${executableName}${ext}`);

  console.log("## Adding fuses to the electron binary", electronBinaryPath);

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    strictlyRequireAllFuses: true,
    resetAdHocDarwinSignature: platform === "darwin" && context.arch === builder.Arch.universal,

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
  });
}
