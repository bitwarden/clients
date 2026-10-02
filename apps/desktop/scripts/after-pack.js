/* eslint-disable @typescript-eslint/no-require-imports, no-console */
require("dotenv").config();
const child_process = require("child_process");
const path = require("path");

const { flipFuses } = require("@electron/fuses");
const builder = require("electron-builder");
const fse = require("fs-extra");

const { electronFuses } = require("./electron-fuses");
const { macOsSigningIdentity } = require("./macos-signing-identity");
exports.default = run;

const IS_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS == "true";

/**
 *
 * @param {builder.AfterPackContext} context
 */
async function run(context) {
  if (IS_GITHUB_ACTIONS) {
    console.log(`::group::After Pack (${builder.Arch[context.arch]})`);
  }
  console.log("## After pack");
  // console.log(context);
  try {
    await doBuild(context);
  } catch (error) {
    console.error("### Error occurred during after-pack phase:", error.stack);
    throw error;
  } finally {
    if (IS_GITHUB_ACTIONS) {
      console.log(`::endgroup::`);
    }
  }
}

async function doBuild(context) {
  const isMacOsBuild = ["darwin", "mas"].includes(context.electronPlatformName);

  let isTargetArch;
  if (!isMacOsBuild) {
    isTargetArch = true;
  } else {
    // When running a universal macOS build, afterPack is called once per arch:
    // x64, arm64, and then finally for universal. For an explicit single-arch
    // build (--x64 / --arm64) it is called only once, for that arch.
    //
    // To determine whether this is the target arch, we need to compare the
    // packager's configured targets with the current target.
    const requestedArchs = context.packager.info.options.targets?.get(context.packager.platform);
    const isUniversalRequested = requestedArchs?.has(builder.Arch.universal) ?? false;
    isTargetArch = isUniversalRequested ? context.arch === builder.Arch.universal : true;
  }

  // TODO: Update this to isTargetArch, and remove resetAdHocDarwinSignature parameter below.
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

  if (isMacOsBuild) {
    if (isTargetArch) {
      console.log("[macOS] Copying extensions...");
      copyMacOsAutofillExtension(context);
      copySafariExtension(context);
    }
    const is_mas = context.electronPlatformName === "mas";

    const id = macOsSigningIdentity(is_mas);

    console.log(
      `Signing proxy binary before the main bundle, using identity '${id}', for build ${context.electronPlatformName}`,
    );

    const appName = context.packager.appInfo.productFilename;
    const appPath = `${context.appOutDir}/${appName}.app`;
    const proxyPath = path.join(appPath, "Contents", "MacOS", "desktop_proxy");
    const inheritProxyPath = path.join(appPath, "Contents", "MacOS", "desktop_proxy.inherit");

    const packageId = context.packager.appInfo.id;

    if (is_mas) {
      const entitlementsName = "entitlements.desktop_proxy.plist";
      const entitlementsPath = path.join(__dirname, "..", "resources", entitlementsName);
      child_process.execSync(
        `codesign -s '${id}' -i ${packageId} -f --timestamp --options runtime --entitlements "${entitlementsPath}" "${proxyPath}"`,
      );

      const inheritEntitlementsName = "entitlements.desktop_proxy.inherit.plist";
      const inheritEntitlementsPath = path.join(
        __dirname,
        "..",
        "resources",
        inheritEntitlementsName,
      );
      child_process.execSync(
        `codesign -s '${id}' -i ${packageId} -f --timestamp --options runtime --entitlements "${inheritEntitlementsPath}" "${inheritProxyPath}"`,
      );
    } else {
      // For non-Appstore builds, we don't need the inherit binary as they are not sandboxed,
      // but we sign and include it anyway for consistency. It should be removed once DDG supports the proxy directly.
      const entitlementsName = "entitlements.mac.inherit.plist";
      const entitlementsPath = path.join(__dirname, "..", "resources", entitlementsName);
      child_process.execSync(
        `codesign -s '${id}' -i ${packageId} -f --timestamp --options runtime --entitlements "${entitlementsPath}" "${proxyPath}"`,
      );
      child_process.execSync(
        `codesign -s '${id}' -i ${packageId} -f --timestamp --options runtime --entitlements "${entitlementsPath}" "${inheritProxyPath}"`,
      );
    }
  }
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
    ...electronFuses(platform),
    resetAdHocDarwinSignature: platform === "darwin" && context.arch === builder.Arch.universal,
  });
}

function copyMacOsAutofillExtension(context) {
  // Currently because the provisioning profiles in the portal do not have the
  // correct entitlements, we leave out the autofill extension except for local
  // dev builds.
  const isMasDevBuild =
    context.electronPlatformName === "mas" && context.targets.at(0)?.name === "mas-dev";
  if (!isMasDevBuild) {
    console.log("### Autofill extension: needs Apple Developer Portal changes. Skipping.");
    return;
  }

  const extensionPath = path.join(__dirname, "../macos/dist/autofill-extension.appex");
  copyMacOsPlugin(context, "Autofill extension", extensionPath);
}

function copySafariExtension(context) {
  const plugIn = path.join(__dirname, "../PlugIns", "safari.appex");
  copyMacOsPlugin(context, "Safari Extension", plugIn);
}

function copyMacOsPlugin(context, targetName, extensionPath) {
  // Pre-signed macOS extensions are copied here in after-pack.js, before electron-builder signs the app, so that
  // the app's own signature seals it.
  //
  // Copying it in after signing leaves the outer bundle invalid ("a sealed
  // resource is missing or invalid") and notarization rejects it unless the
  // whole package is signed a second time. electron-builder never signs
  // anything under Contents/PlugIns, so the extension keeps the signature and
  // entitlements XCode gave it.
  //
  // We cannot use extraFiles because it modifies the extension's .plist and makes it invalid. Cf.
  // https://github.com/electron-userland/electron-builder/issues/5552.

  if (!["darwin", "mas"].includes(context.electronPlatformName)) {
    // not a macOS build, skipping.
    console.log(`### ${targetName}: Not macOS build. Skipping.`);
    return;
  }

  if (!fse.existsSync(extensionPath)) {
    console.log(`### ${targetName}: ${extensionPath} not found - skipping`);
    return;
  }

  console.log(`### ${targetName}: Copying plugin...`);

  // Make PlugIns directory.
  const appName = context.packager.appInfo.productFilename;
  const plugInsPath = path.join(context.appOutDir, `${appName}.app`, "Contents/PlugIns");
  fse.mkdirSync(plugInsPath, { recursive: true });

  // Copy extension
  const name = path.basename(extensionPath);
  const output = path.join(plugInsPath, name);
  fse.copySync(extensionPath, output);
  console.log(`### ${targetName}: Copied ${extensionPath} to ${output}.`);
}
