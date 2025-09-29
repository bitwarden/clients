t; /* eslint-disable @typescript-eslint/no-require-imports, no-console */
require("dotenv").config();
const child_process = require("child_process");
const path = require("path");

const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");
const builder = require("electron-builder");
const fse = require("fs-extra");

exports.default = run;

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

  if (["darwin", "mas"].includes(context.electronPlatformName)) {
    const is_mas = context.electronPlatformName === "mas";
    const is_mas_dev = context.targets.some((e) => e.name === "mas-dev");

    let id;

    // Only use the Bitwarden Identities on CI
    if (process.env.GITHUB_ACTIONS === "true") {
      if (is_mas) {
        id = is_mas_dev
          ? "588E3F1724AE018EBA762E42279DAE85B313E3ED"
          : "3rd Party Mac Developer Application: Bitwarden Inc";
      } else {
        id = "Developer ID Application: 8bit Solutions LLC";
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

    const packageId = "com.bitwarden.desktop";

    if (is_mas) {
      const entitlementsName = "entitlements.desktop_proxy.plist";
      const entitlementsPath = path.join(__dirname, "..", "resources", entitlementsName);
      child_process.execSync(
        `codesign -s '${id}' -i ${packageId} -f --timestamp --options runtime --entitlements ${entitlementsPath} ${proxyPath}`,
      );

      const inheritEntitlementsName = "entitlements.desktop_proxy.inherit.plist";
      const inheritEntitlementsPath = path.join(
        __dirname,
        "..",
        "resources",
        inheritEntitlementsName,
      );
      child_process.execSync(
        `codesign -s '${id}' -i ${packageId} -f --timestamp --options runtime --entitlements ${inheritEntitlementsPath} ${inheritProxyPath}`,
      );
    } else {
      // For non-Appstore builds, we don't need the inherit binary as they are not sandboxed,
      // but we sign and include it anyway for consistency. It should be removed once DDG supports the proxy directly.
      const entitlementsName = "entitlements.mac.inherit.plist";
      const entitlementsPath = path.join(__dirname, "..", "resources", entitlementsName);
      child_process.execSync(
        `codesign -s '${id}' -i ${packageId} -f --timestamp --options runtime --entitlements ${entitlementsPath} ${proxyPath}`,
      );
      child_process.execSync(
        `codesign -s '${id}' -i ${packageId} -f --timestamp --options runtime --entitlements ${entitlementsPath} ${inheritProxyPath}`,
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
    : context.packager.appInfo.productFilename; // .toLowerCase() to accomodate Linux file named `name` but productFileName is `Name` -- Replaces '-dev' because on Linux the executable name is `name` even for the DEV builds

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
  });
}
