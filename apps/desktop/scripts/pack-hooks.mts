/* eslint-disable no-console */

/// The parts of packaging that electron-builder cannot be told, only shown.
///
/// Flipping Electron's fuses, wrapping the Linux binary, embedding the macOS app extensions and
/// notarizing all happen to a directory electron-builder has already written, so they run as
/// its `afterPack` and `afterSign` callbacks. That much is unavoidable. What was avoidable was
/// where they got their instructions: as `scripts/after-pack.js` and `scripts/after-sign.js`
/// they were separate programs that had to work out what kind of build they were in, and did it
/// by reading `GITHUB_ACTIONS` to choose a signing identity and `existsSync` to decide whether
/// the autofill extension was wanted. Here they are functions closed over the build
/// configuration, so they are told.
///
/// The extensions are embedded in `afterPack`, before electron-builder signs, rather than in
/// `afterSign` as before. Copying into a bundle after it has been signed breaks the signature,
/// which the old hook then repaired by signing the app a second time -- and only when the
/// Safari extension was among what it copied, so an autofill-only build was left with a seal
/// that no longer covered its own contents.

import { execFileSync } from "child_process";
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, renameSync, rmSync } from "fs";
import path from "path";

import { FuseV1Options, FuseVersion, flipFuses } from "@electron/fuses";
import { notarize } from "@electron/notarize";
import { Arch, type AfterPackContext, type LinuxPackager } from "electron-builder";

import { type BuildConfig, BuildError } from "./build-config.mts";
import { projectDir } from "./build-support.mts";
import { TEAM_ID } from "./entitlements.mts";

/// Replaces the app's own binary so that the real one runs under a wrapper that turns off
/// ptrace-style memory access. Linux only.
const LINUX_WRAPPER = "resources/linux-wrapper.sh";
const LINUX_REAL_BINARY = "bitwarden-app";

export interface PackHooks {
  afterPack: (context: AfterPackContext) => Promise<void>;
  afterSign: (context: AfterPackContext) => Promise<void>;
}

export function packHooks(config: BuildConfig): PackHooks {
  return {
    afterPack: (context) => afterPack(config, context),
    afterSign: (context) => afterSign(config, context),
  };
}

async function afterPack(config: BuildConfig, context: AfterPackContext): Promise<void> {
  console.log("## after pack");

  // On macOS the fuses are flipped on the merged universal binary instead, because
  // @electron/universal rebuilds it from the per-architecture ones and would discard them.
  if (context.packager.platform.nodeName !== "darwin" || context.arch === Arch.universal) {
    await addFuses(context);
  }

  if (context.electronPlatformName === "linux") {
    installLinuxWrapper(context);
  }

  if (isMacOS(context)) {
    embedExtensions(config, context);
    signProxy(config, context);
  }
}

async function afterSign(config: BuildConfig, context: AfterPackContext): Promise<void> {
  if (config.macos?.notarize !== true) {
    return;
  }
  // Reached only on macOS: --notarize is rejected for any other platform, and for the App Store
  // channels, which Apple notarizes itself on submission.
  await notarizeApp(appPath(context));
}

/// Electron's fuses are compile-time switches flipped in the binary after the fact. Every one
/// of these is a hardening measure, and `strictlyRequireAllFuses` makes a version of Electron
/// that no longer has one an error rather than a silent downgrade.
async function addFuses(context: AfterPackContext): Promise<void> {
  const platform = context.packager.platform.nodeName;
  const extension = { darwin: ".app", win32: ".exe", linux: "" }[platform as string] ?? "";

  // On Linux the executable is lowercased and hyphenated, and the DEV build's binary is named
  // like the release one.
  const executable =
    platform === "linux"
      ? context.packager.appInfo.productFilename.toLowerCase().replace("-dev", "").replace(" ", "-")
      : context.packager.appInfo.productFilename;

  const binary = path.join(context.appOutDir, `${executable}${extension}`);
  console.log(`Adding fuses to ${binary}`);

  await flipFuses(binary, {
    version: FuseVersion.V1,
    strictlyRequireAllFuses: true,
    resetAdHocDarwinSignature: platform === "darwin" && context.arch === Arch.universal,

    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,

    // asar integrity is only implemented for macOS and Windows.
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]:
      platform === "darwin" || platform === "win32",

    [FuseV1Options.OnlyLoadAppFromAsar]: true,

    // The app refuses to open with this on.
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,

    // Turning this off means not loading the bundle over file://, which would need a custom
    // app:// protocol -- and then CORS blocks every request to the server.
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,

    // Lets V8 trap out-of-bounds WebAssembly memory access.
    [FuseV1Options.WasmTrapHandlers]: true,
  });
}

/// Moves the real binary aside and puts a wrapper script in its place, so that what the desktop
/// entry launches is the wrapper.
function installLinuxWrapper(context: AfterPackContext): void {
  // Only reached for Linux, which is the packager that names an executable.
  const { executableName } = context.packager as LinuxPackager;
  const executable = path.join(context.appOutDir, executableName);
  renameSync(executable, path.join(context.appOutDir, LINUX_REAL_BINARY));

  copyFileSync(path.join(projectDir, LINUX_WRAPPER), executable);
  chmodSync(executable, 0o755);
  console.log(`Wrapped ${executableName} (real binary is ${LINUX_REAL_BINARY})`);
}

/// Copies the app extensions into the bundle before it is signed, so electron-builder's signing
/// pass covers them.
///
/// Not `extraFiles`: electron-builder rewrites the Info.plist of anything listed there, which
/// leaves an .appex that macOS will not load.
function embedExtensions(config: BuildConfig, context: AfterPackContext): void {
  const extensions: { name: string; from: string }[] = [];

  if (config.targets.macosAutofillExtension === true) {
    extensions.push({
      name: "autofill-extension.appex",
      from: config.intermediates.macosAutofillExtension,
    });
  }
  // Built elsewhere and passed in with --safari-extension, so it is named by `dependencies`
  // rather than staged into this build directory.
  if (config.dependencies.safariExtension != null) {
    extensions.push({ name: "safari.appex", from: config.dependencies.safariExtension.path });
  }
  if (extensions.length === 0) {
    return;
  }

  const plugIns = path.join(appPath(context), "Contents", "PlugIns");
  mkdirSync(plugIns, { recursive: true });

  for (const { name, from } of extensions) {
    const source = path.resolve(projectDir, from);
    if (!existsSync(source)) {
      throw new BuildError(
        `The configuration includes ${name}, but there is nothing at ${source}.\n` +
          `       Run: bw-task build --build-dir ${config.buildDir}`,
      );
    }
    const destination = path.join(plugIns, name);
    rmSync(destination, { recursive: true, force: true });
    // Verbatim, so a signed bundle survives the copy with its signature intact.
    cpSync(source, destination, { recursive: true, verbatimSymlinks: true });
    console.log(`Embedded ${name}`);
  }
}

/// Signs the native messaging proxy ahead of the bundle it sits in.
///
/// The proxy is launched by the browser rather than by the app, so on an App Store build it
/// cannot inherit the app's sandbox and needs the app group named in entitlements of its own --
/// which is not what electron-builder would give it.
function signProxy(config: BuildConfig, context: AfterPackContext): void {
  const identity = config.macos?.signingCertificate;
  if (identity == null || identity === "none") {
    // Nothing was named to sign with. electron-builder signs the bundle's contents with the
    // inherited entitlements during its own pass, which is what these binaries would get here
    // anyway outside the App Store -- and an App Store build cannot reach this point, because
    // configure requires an identity for one.
    return;
  }

  const entitlements = config.derived.macos?.entitlements;
  if (entitlements == null) {
    throw new BuildError("The configuration generated no entitlements. Reconfigure the build.");
  }

  const contents = path.join(appPath(context), "Contents", "MacOS");
  const sign = (binary: string, using: string) => {
    execFileSync("codesign", [
      "--sign",
      identity,
      "--identifier",
      context.packager.appInfo.id,
      "--force",
      "--timestamp",
      "--options",
      "runtime",
      "--entitlements",
      path.resolve(projectDir, using),
      path.join(contents, binary),
    ]);
    console.log(`Signed ${binary}`);
  };

  sign("desktop_proxy", entitlements.desktopProxy);
  // The same binary again, for the app to launch itself. It should go once DDG talks to the
  // proxy directly.
  sign("desktop_proxy.inherit", entitlements.desktopProxyInherit);
}

async function notarizeApp(app: string): Promise<void> {
  console.log(`Notarizing ${app}`);

  // Credentials are secrets, so they come from the environment rather than the build
  // configuration, which is written to a file and carried between machines.
  const issuer = process.env.APP_STORE_CONNECT_TEAM_ISSUER;
  const apiKey = process.env.APP_STORE_CONNECT_AUTH_KEY_PATH;
  const apiKeyId = process.env.APP_STORE_CONNECT_AUTH_KEY_ID;
  if (issuer != null && apiKey != null && apiKeyId != null) {
    await notarize({
      appPath: app,
      appleApiIssuer: issuer,
      appleApiKey: apiKey,
      appleApiKeyId: apiKeyId,
    });
    return;
  }

  const appleId = process.env.APPLE_ID_USERNAME ?? process.env.APPLEID;
  if (appleId != null) {
    await notarize({
      appPath: app,
      teamId: TEAM_ID,
      appleId,
      appleIdPassword: process.env.APPLE_ID_PASSWORD ?? "@keychain:AC_PASSWORD",
    });
    return;
  }

  // Reported rather than skipped: the caller asked for a notarized build and would otherwise
  // get an un-notarized one that looks finished.
  throw new BuildError(
    "--notarize needs credentials in the environment: either APP_STORE_CONNECT_TEAM_ISSUER, " +
      "APP_STORE_CONNECT_AUTH_KEY_PATH and APP_STORE_CONNECT_AUTH_KEY_ID together, or " +
      "APPLE_ID_USERNAME with APPLE_ID_PASSWORD.",
  );
}

function isMacOS(context: AfterPackContext): boolean {
  return ["darwin", "mas"].includes(context.electronPlatformName);
}

function appPath(context: AfterPackContext): string {
  return path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
}
