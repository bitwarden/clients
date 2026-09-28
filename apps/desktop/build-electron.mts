import {
  readFileSync,
  readdirSync,
  mkdirSync,
  renameSync,
  existsSync,
  rmSync,
  writeFileSync,
} from "fs";
import { execFile } from "child_process";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

import {
  type Architecture,
  BuildError,
  getBuildDirectories,
  type Platform,
  type BuildConfig,
  type BuildTask,
} from "./scripts/build-config.mts";
import { Logger, runCommand } from "./scripts/build-support.mts";

import WebpackBuildTask from "./build-app.mts";
import ChromiumImporterBuildTask from "./desktop_native/chromium_importer/build-chromium-importer.mts";
import ProcessIsolationBuildTask from "./desktop_native/process_isolation/build-process-isolation.mts";
import DesktopProxyBuildTask, {
  desktopProxyEntitlementsPaths,
} from "./desktop_native/proxy/build-desktop-proxy.mts";
import NapiBuildTask from "./desktop_native/napi/scripts/build-napi.mts";
import BitwardenMacosAutofillExtensionBuildTask from "./macos/Scripts/build-autofill-extension.mts";

import {
  build as electronBuilder,
  Arch as ElectronArchitecture,
  Platform as ElectronPlatform,
  type AfterPackContext,
  type Configuration,
  type CliOptions,
} from "electron-builder";
import { flipFuses, FuseV1Options, FuseVersion, type FuseConfig } from "@electron/fuses";
import { notarize } from "@electron/notarize";
import { makeUniversalApp } from "@electron/universal";
import { executeAppBuilder } from "builder-util";
import { isBinaryFile } from "isbinaryfile";
import plist from "plist";

const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));

const ELECTRON_FRAMEWORK = "Electron Framework.framework";

/// Everything in the electron-builder configuration that does not vary per build.
const BASE_CONFIG = path.resolve(SOURCE_DIR, "electron-builder.base.json");

/// Where the native addon lives inside the packaged app, which is where index.js looks for it.
const NAPI_PACKAGE = "node_modules/@bitwarden/desktop-napi";

/// Directories the sandboxed app is allowed to write a native messaging host manifest into, so
/// that the browser extension can talk to the desktop app. Relative to the user's home.
const NATIVE_MESSAGING_HOST_DIRS = [
  "/Library/Application Support/Mozilla/NativeMessagingHosts/",
  "/Library/Application Support/Google/Chrome/NativeMessagingHosts/",
  "/Library/Application Support/Google/Chrome Beta/NativeMessagingHosts/",
  "/Library/Application Support/Google/Chrome Dev/NativeMessagingHosts/",
  "/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts/",
  "/Library/Application Support/Chromium/NativeMessagingHosts/",
  "/Library/Application Support/Microsoft Edge/NativeMessagingHosts/",
  "/Library/Application Support/Microsoft Edge Beta/NativeMessagingHosts/",
  "/Library/Application Support/Microsoft Edge Dev/NativeMessagingHosts/",
  "/Library/Application Support/Microsoft Edge Canary/NativeMessagingHosts/",
  "/Library/Application Support/Vivaldi/NativeMessagingHosts/",
  "/Library/Application Support/Zen/NativeMessagingHosts/",
  "/Library/Application Support/net.imput.helium/NativeMessagingHosts/",
];

const ElectronPlatformMap: Record<Platform, ElectronPlatform> = {
  linux: ElectronPlatform.LINUX,
  macos: ElectronPlatform.MAC,
  windows: ElectronPlatform.WINDOWS,
};

const ElectronArchitectureMap: Record<Architecture, ElectronArchitecture> = {
  ia32: ElectronArchitecture.ia32,
  x64: ElectronArchitecture.x64,
  arm64: ElectronArchitecture.arm64,
  universal: ElectronArchitecture.universal,
};

const ElectronBuildTask: BuildTask = {
  targetName: "ElectronBuildTask",
  sourceDir: SOURCE_DIR,
  dependencies: [
    BitwardenMacosAutofillExtensionBuildTask,
    ChromiumImporterBuildTask,
    DesktopProxyBuildTask,
    NapiBuildTask,
    ProcessIsolationBuildTask,
    WebpackBuildTask,
  ],

  async validate(config: BuildConfig): Promise<void> {
    const validationErrors: BuildError[] = [];

    if (!config.platform) {
      validationErrors.push(new BuildError("Platform not set"));
    }

    if (!config.profile) {
      validationErrors.push(new BuildError("Profile not set"));
    }

    if (!config.toolchains.cargo.bin) {
      validationErrors.push(new BuildError("Path to Cargo binary not set"));
    }

    if (validationErrors.length > 0) {
      throw new AggregateError(
        validationErrors,
        `Build configuration of ${this.targetName} failed validation`,
      );
    }
  },

  async configure(config: BuildConfig, outputDir: string, privateDir: string): Promise<void> {
    if (config.platform === "macos") {
      writeEntitlements(config, privateDir);
      if (usesSignedFramework(config)) {
        await signElectronFramework(config, privateDir, readBaseConfig());
      }
    }
  },

  async build(config: BuildConfig, outputDir: string, privateDir: string): Promise<void> {
    const baseConfig = readBaseConfig();
    if (usesSignedFramework(config)) {
      checkSignedFramework(config, privateDir, baseConfig);
    }
    const electronTargets = [];
    for (const packageFormat of config.packageFormats) {
      switch (packageFormat) {
        case "mac-app-store":
          if (config.audience == "public") {
            electronTargets.push("mas");
          } else if (config.audience == "internal") {
            electronTargets.push("mas-dev");
          } else {
            throw new BuildError(`Unknown audience: ${config.audience}`);
          }
          break;
        case "dmg":
          electronTargets.push("dmg");
          break;
        case "mac-zip":
          electronTargets.push("zip");
          break;
        case "dir":
          electronTargets.push("dir");
          break;
      }
    }

    let macConfig: Configuration = {};
    if (config.platform == "macos") {
      const entitlements = entitlementsPaths(config, privateDir);
      const c = {
        identity: config.macos!.signingCertificate,
        provisioningProfile: config.derived.macos!.appProvisioningProfilePath,
        notarize: config.macos!.notarize,
        entitlements: entitlements.app,
        entitlementsInherit: entitlements.appInherit,
        ...(entitlements.loginHelper != null
          ? { entitlementsLoginHelper: entitlements.loginHelper }
          : {}),
        ...(wantsSecureTimestamp(config) ? {} : { timestamp: "none" }),
        // configure signed the framework already, and afterPack puts that copy in place.
        ...(usesSignedFramework(config)
          ? { signIgnore: [`/Frameworks/${ELECTRON_FRAMEWORK.replace(".", "\\.")}(/|$)`] }
          : {}),
      };
      const nullSigning = { identity: null, provisioningProfile: null };
      if (config.derived.macos!.isMasBuild) {
        macConfig = { mas: c, mac: nullSigning };
      } else {
        macConfig = { mas: nullSigning, mac: c };
      }
    }
    const privateAppPath = path.join(
      privateDir,
      config.derived.electronFolder,
      `${config.derived.productName}.app`,
    );
    if (existsSync(privateAppPath)) {
      rmSync(privateAppPath, { recursive: true });
    }
    const electronBuilderOptions = {
      projectDir: SOURCE_DIR,
      // The hooks and the absolute paths go on after the file is written -- what is recorded there
      // stays the configuration, relative and readable, not the form it has to take to run.
      config: mergePlatformSections(
        {
          // Named rather than spread in, because otherwise electron-builder goes looking for a
          // configuration of its own in the project directory -- and finds Legacy's
          // electron-builder.json, which names binaries this build did not produce. It loads the
          // file named here instead, and merges the rest of this object over it. Arrays are merged
          // as a union, so only what this build adds to them goes here.
          extends: BASE_CONFIG,
          files: nativeModule(config),
          asarUnpack: ["**/desktop_napi.*.node"],
          ...{
            directories: {
              buildResources: path.resolve(SOURCE_DIR, "resources"),
              app: getBuildDirectories(config, WebpackBuildTask).outputDir,
              output: privateDir,
            },
            // Returning false tells electron-builder that node_modules are handled elsewhere, so it
            // neither rebuilds native dependencies nor collects any. Webpack bundles everything the
            // app uses except the externals, so there is nothing to collect -- but the webpack output
            // has no node_modules, and electron-builder would otherwise go looking in the workspace
            // root and package all of that.
            beforeBuild: async () => false,
            beforePack: () => {},
            afterPack: (context: AfterPackContext) => afterPack(config, privateDir, context),
            afterSign: () => afterSign(config, privateDir),
          },
          ...macConfig,
          /*
        ...withAbsoluteSigningPaths(resolved),
        ...packHooks(config),
        ...appxManifestHook(config),
        */
        },
        nativeExecutables(config),
      ),
      targets: ElectronPlatformMap[config.platform].createTarget(
        electronTargets,
        ElectronArchitectureMap[config.architecture],
      ),
      publish: "never",
    } as CliOptions;
    Logger.debug(electronBuilderOptions);
    await electronBuilder(electronBuilderOptions);

    const outputPath = path.join(outputDir, path.basename(privateAppPath));
    if (existsSync(outputPath)) {
      rmSync(outputPath, { recursive: true });
    }
    renameSync(privateAppPath, outputPath);
    Logger.log(`Application written to ${outputPath}`);
  },
};

/// The native Node addon, the one webpack external the app needs at runtime, taken whole from
/// what NapiBuildTask built.
///
/// Not from node_modules: the `.node` files there are whatever was compiled into the crate
/// directory last, along with the ones committed for other platforms. That is not necessarily
/// this build: napi-rs leaves a copy there as a side effect of every build, so packaging one
/// configuration after building another would ship the other one's module, with no sign that it
/// had. The destination is where node_modules would have put it, which is what keeps
/// `singleArchFiles` and `x64ArchFiles` -- the universal merge's account of which files exist in
/// only one architecture -- pointing at the right thing.
///
/// electron-builder only detects native code in what it collects from node_modules, so the
/// module has to be named in `asarUnpack` to land in app.asar.unpacked, where it can be loaded.
function nativeModule(config: BuildConfig) {
  const { outputDir: napiOutputDir } = getBuildDirectories(config, NapiBuildTask);
  return [{ from: napiOutputDir, to: NAPI_PACKAGE, filter: ["*.node", "index.js"] }];
}

/// The executables other build tasks produced that ship beside the app, for whichever of those
/// tasks are part of this build. Keyed by the platform section of the configuration they belong
/// in.
function nativeExecutables(config: BuildConfig): Configuration {
  const built = (task: BuildTask, file: string) =>
    config.targets.includes(task.targetName)
      ? [path.join(getBuildDirectories(config, task).outputDir, file)]
      : [];

  switch (config.platform) {
    case "macos":
      return {
        mac: {
          // The same binary twice: the browser launches desktop_proxy, which has to name the app
          // group itself, and the app launches desktop_proxy.inherit, which takes on the app's
          // sandbox. afterPack signs each with its own entitlements.
          extraFiles: built(DesktopProxyBuildTask, "desktop_proxy").flatMap((from) => [
            { from, to: "MacOS/desktop_proxy" },
            { from, to: "MacOS/desktop_proxy.inherit" },
          ]),
        },
      };
    case "windows":
      return {
        win: {
          extraFiles: [
            ...built(DesktopProxyBuildTask, "desktop_proxy.exe").map((from) => ({
              from,
              to: "desktop_proxy.exe",
            })),
            ...built(ChromiumImporterBuildTask, "bitwarden_chromium_import_helper.exe").map(
              (from) => ({ from, to: "bitwarden_chromium_import_helper.exe" }),
            ),
          ],
        },
      };
    case "linux":
      return {
        linux: {
          extraFiles: [
            ...built(DesktopProxyBuildTask, "desktop_proxy").map((from) => ({
              from,
              to: "desktop_proxy",
            })),
            ...built(ProcessIsolationBuildTask, "libprocess_isolation.so").map((from) => ({
              from,
              to: "libprocess_isolation.so",
            })),
          ],
        },
      };
  }
}

/// Merges each platform section of `sections` into the one already in `config`, rather than
/// replacing it.
function mergePlatformSections(config: Configuration, sections: Configuration): Configuration {
  const merged: Record<string, unknown> = { ...config };
  for (const [key, section] of Object.entries(sections)) {
    merged[key] = { ...(merged[key] as object), ...section };
  }
  return merged as Configuration;
}

/// Where configure writes the entitlements the app is signed with. electron-builder hands these
/// to `codesign` as given, and `codesign` resolves them against the working directory rather than
/// the project, so they are absolute.
function entitlementsPaths(config: BuildConfig, privateDir: string) {
  return {
    app: path.join(privateDir, "entitlements.app.plist"),
    appInherit: path.join(privateDir, "entitlements.app.inherit.plist"),
    // Only App Store builds have a login helper to sign.
    loginHelper: config.derived.macos!.isMasBuild
      ? path.join(privateDir, "entitlements.loginhelper.plist")
      : null,
  };
}

/// Entitlements are what the signature actually grants, so they are written from the
/// configuration rather than picked from a set of checked-in near-copies. The AutoFill
/// credential provider entitlement is claimed only when the extension is part of the build:
/// nothing else in the app uses it, and an entitlement in the file is one the binary has.
function writeEntitlements(config: BuildConfig, privateDir: string) {
  const paths = entitlementsPaths(config, privateDir);
  const teamId = config.macos!.teamId;
  const identity = {
    "com.apple.application-identifier": `${teamId}.${config.derived.appId}`,
    "com.apple.developer.team-identifier": teamId,
  };
  // An entitlement set to false is still an entitlement in the file, and asking for one the
  // provisioning profile does not carry fails the signature.
  const autofill = config.features.autofillExtension
    ? { "com.apple.developer.authentication-services.autofill-credential-provider": true }
    : {};
  const write = (destination: string, entitlements: Record<string, unknown>) =>
    writeFileSync(
      destination,
      `${plist.build(entitlements as plist.PlistObject, { indent: "\t", offset: -1 })}\n`,
    );

  if (config.derived.macos!.isMasBuild) {
    // A sandboxed App Store app has to name every capability it needs.
    write(paths.app, {
      ...identity,
      "com.apple.security.app-sandbox": true,
      "com.apple.security.application-groups": [config.derived.macos!.ipcAppGroup],
      "com.apple.security.cs.allow-jit": true,
      "com.apple.security.device.usb": true,
      "com.apple.security.files.bookmarks.app-scope": true,
      "com.apple.security.files.user-selected.read-write": true,
      "com.apple.security.network.client": true,
      "com.apple.security.temporary-exception.files.home-relative-path.read-write":
        NATIVE_MESSAGING_HOST_DIRS,
      ...autofill,
    });
    // `inherit` is what makes a child take the parent's sandbox rather than being denied
    // everything.
    write(paths.appInherit, {
      "com.apple.security.app-sandbox": true,
      "com.apple.security.cs.allow-jit": true,
      "com.apple.security.inherit": true,
    });
    write(paths.loginHelper!, { "com.apple.security.app-sandbox": true });
  } else {
    // A directly distributed app is not sandboxed, and names far fewer.
    write(paths.app, { ...identity, "com.apple.security.cs.allow-jit": true, ...autofill });
    write(paths.appInherit, { "com.apple.security.cs.allow-jit": true });
  }
}

function readBaseConfig() {
  const baseConfigPath = path.resolve(SOURCE_DIR, "electron-builder.base.json");
  return JSON.parse(readFileSync(baseConfigPath, { encoding: "utf-8" }));
}

/// A secure timestamp is a round trip to Apple for each file codesign signs, which is most of the
/// signing time. Notarization requires one, and a public build may be notarized or submitted
/// later, but an internal build that is not notarized cannot pass Gatekeeper on another
/// developer's machine anyway, so it has no use for one.
function wantsSecureTimestamp(config: BuildConfig): boolean {
  return config.macos!.notarize === true || config.audience !== "internal";
}

/// Whether configure signs Electron's framework, so that the build does not have to.
///
/// The framework is more than 230 of the app's ~250 signed files, and nothing about it changes
/// from one build to the next: electron-builder copies it out of the Electron distribution
/// untouched. Every input to its signature -- the identity, the inherited entitlements, the
/// timestamp and hardened runtime settings, the platform and architecture -- is fixed at
/// configure time, except the Electron version, which build checks.
function usesSignedFramework(config: BuildConfig): boolean {
  return config.macos?.signingCertificate != null;
}

function signedFrameworkPaths(privateDir: string) {
  const dir = path.join(privateDir, "signed-electron-framework");
  return {
    dir,
    framework: path.join(dir, ELECTRON_FRAMEWORK),
    stamp: path.join(dir, "stamp.json"),
  };
}

/// Signs the framework from the Electron distribution electron-builder will pack, file by file
/// the way @electron/osx-sign would inside the app, and leaves it for afterPack to put in place.
async function signElectronFramework(
  config: BuildConfig,
  privateDir: string,
  baseConfig: Configuration,
) {
  const electronVersion = baseConfig.electronVersion!;
  const isMas = config.derived.macos!.isMasBuild;
  const { dir, framework, stamp } = signedFrameworkPaths(privateDir);
  rmSync(dir, { recursive: true, force: true });
  const extracted = path.join(dir, "extracted");

  // The Electron.app from the distribution for one architecture, unpacked.
  const electronApp = async (arch: string) => {
    const zip = await downloadElectron(config.derived.hostPlatform, {
      platform: isMas ? "mas" : "darwin",
      arch,
      version: electronVersion,
      ...baseConfig.electronDownload,
    });
    await runCommand("ditto", ["-x", "-k", zip, path.join(extracted, arch)]);
    return path.join(extracted, arch, "Electron.app");
  };

  let app: string;
  if (config.architecture === "universal") {
    // electron-builder packs an app for each architecture and merges them with
    // @electron/universal, frameworks included, so merging the two distributions the same way
    // gives the framework it would produce, and it can be signed now and put in place of that
    // one. The one difference is ElectronAsarIntegrity in the framework's Info.plist, which the
    // merge rewrites to name the app's asar. Electron reads it from the app's Info.plist, and a
    // single-architecture build ships the distribution's entry here too.
    app = path.join(extracted, "universal", "Electron.app");
    const x64App = await electronApp("x64");
    const arm64App = await electronApp("arm64");
    // @electron/universal merges packaged apps, and fails on a bare distribution, which has no
    // app of its own. An empty one, the same in both, is passed through untouched.
    for (const a of [x64App, arm64App]) {
      mkdirSync(path.join(a, "Contents/Resources/app"));
    }
    await makeUniversalApp({
      x64AppPath: x64App,
      arm64AppPath: arm64App,
      outAppPath: app,
      force: true,
    });
  } else {
    app = await electronApp(config.architecture);
  }
  renameSync(path.join(app, "Contents/Frameworks", ELECTRON_FRAMEWORK), framework);
  rmSync(extracted, { recursive: true });

  // The fuses are in the framework binary, so they are flipped before it is signed.
  await flipFuses(path.join(framework, "Electron Framework"), electronFuses(config));

  // As electron-builder hands them to osx-sign for anything that is not the app, a helper or the
  // login item. Hardened runtime is opt-in for App Store builds and opt-out otherwise.
  const hardenedRuntime = isMas
    ? (baseConfig.mas?.hardenedRuntime ?? baseConfig.mac?.hardenedRuntime) === true
    : baseConfig.mac?.hardenedRuntime !== false;
  const args = [
    "--sign",
    config.macos!.signingCertificate!,
    "--force",
    wantsSecureTimestamp(config) ? "--timestamp" : "--timestamp=none",
    ...(hardenedRuntime ? ["--options", "runtime"] : []),
    "--entitlements",
    entitlementsPaths(config, privateDir).appInherit,
  ];

  // osx-sign signs every binary file, then the bundle.
  const files = await binaryFiles(framework);
  Logger.log(`Signing ${files.length} files in ${ELECTRON_FRAMEWORK} ${electronVersion}`);
  const sign = async (file: string) => {
    // Captured rather than inherited: codesign reports "replacing existing signature" for every
    // file, because Electron ships them signed by its own identity.
    try {
      await promisify(execFile)("codesign", [...args, file]);
    } catch (e) {
      throw new BuildError(
        `codesign failed for ${file}: ${(e as { stderr?: string }).stderr ?? e}`,
      );
    }
  };
  // The files are leaves -- there is no bundle nested inside the framework -- so they can be
  // signed in any order, and only the bundle's own signature, which seals them, has to wait.
  const queue = [...files];
  const worker = async () => {
    for (let file = queue.shift(); file != null; file = queue.shift()) {
      await sign(file);
    }
  };
  await Promise.all(Array.from({ length: os.availableParallelism() }, worker));
  await sign(framework);

  const recorded: SignedFrameworkStamp = { electronVersion, fuses: electronFuses(config) };
  writeFileSync(stamp, JSON.stringify(recorded));
}

/// Fetches the Electron zip into electron-builder's cache, unless it is already there, and returns
/// its path. electron-builder downloads through app-builder, whose cache is a flat directory of
/// `electron-v<version>-<platform>-<arch>.zip`, so the same command is used here and the zip is
/// downloaded once for both. @electron/get would work too, but nests its cache under a hash of the
/// URL, so the packaging step would download the same file again.
async function downloadElectron(
  hostPlatform: Platform,
  options: {
    platform: string;
    arch: string;
    version: string;
    cache?: string | null;
    customFilename?: string | null;
  },
): Promise<string> {
  await executeAppBuilder(["download-electron", "--configuration", JSON.stringify([options])]);
  const cache = options.cache ?? process.env.ELECTRON_CACHE ?? defaultElectronCache(hostPlatform);
  const filename =
    options.customFilename ??
    `electron-v${options.version}-${options.platform}-${options.arch}.zip`;
  return path.join(cache, filename);
}

/// Where app-builder caches Electron downloads when nothing overrides it.
function defaultElectronCache(hostPlatform: Platform): string {
  switch (hostPlatform) {
    case "macos":
      return path.join(os.homedir(), "Library/Caches/electron");
    default:
      throw new BuildError(
        `Locating the Electron download cache is not implemented yet on ${hostPlatform}.`,
      );
  }
}

/// Regular files under dir that are binary, by the same test osx-sign uses. Symlinks are not
/// followed: a framework's top-level entries all point into Versions/A, and going through them
/// would only find the same files again.
async function binaryFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await binaryFiles(file)));
    } else if (entry.isFile() && (await isBinaryFile(file))) {
      files.push(file);
    }
  }
  return files;
}

/// What configure recorded about the framework it signed: the inputs to it that do not come from
/// the build configuration, and so can change without configure being run again.
interface SignedFrameworkStamp {
  electronVersion: string;
  fuses: FuseConfig;
}

/// The Electron version is read from electron-builder.base.json on every build, and the fuses
/// from this file, but the framework was signed with what they were at configure time.
function checkSignedFramework(config: BuildConfig, privateDir: string, baseConfig: Configuration) {
  const { stamp } = signedFrameworkPaths(privateDir);
  const recorded = existsSync(stamp)
    ? (JSON.parse(readFileSync(stamp, "utf-8")) as SignedFrameworkStamp)
    : null;
  const rerun = "Re-run build-configure for this build directory to pick up the change.";
  if (recorded == null) {
    throw new BuildError(`This build directory has no signed ${ELECTRON_FRAMEWORK}. ${rerun}`);
  }
  if (recorded.electronVersion !== baseConfig.electronVersion) {
    throw new BuildError(
      `electron-builder.base.json names Electron ${baseConfig.electronVersion}, but this build ` +
        `directory's signed ${ELECTRON_FRAMEWORK} is for Electron ${recorded.electronVersion}. ${rerun}`,
    );
  }
  if (JSON.stringify(recorded.fuses) !== JSON.stringify(electronFuses(config))) {
    throw new BuildError(
      `The Electron fuses have changed since this build directory's ${ELECTRON_FRAMEWORK} was ` +
        `signed. ${rerun}`,
    );
  }
}

/// Electron features that are compiled in but can be switched off in the shipped binary. See
/// https://www.electronjs.org/docs/latest/tutorial/fuses for the list and their defaults.
function electronFuses(config: BuildConfig): FuseConfig {
  return {
    version: FuseVersion.V1,
    strictlyRequireAllFuses: true,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    // Asar integrity is only implemented for macOS and Windows.
    // https://www.electronjs.org/docs/latest/tutorial/asar-integrity
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]:
      config.platform === "macos" || config.platform === "windows",
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    // The app refuses to open when enabled.
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    // To disable this, we should stop using the file:// protocol to load the app bundle. This can
    // be done by defining a custom app:// protocol and loading the bundle from there, but then any
    // requests to the server will be blocked by CORS policy.
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
    // Enables V8 signal handlers to trap out-of-bounds memory access from WebAssembly.
    [FuseV1Options.WasmTrapHandlers]: true,
  };
}

async function afterPack(config: BuildConfig, privateDir: string, context: AfterPackContext) {
  // A universal build packs an app for each architecture first, calling this for each, and then
  // again for the app merged from them. Only that last one is signed and shipped.
  if (context.arch !== ElectronArchitectureMap[config.architecture]) {
    return;
  }

  if (config.platform === "macos") {
    const appDir = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);

    if (usesSignedFramework(config)) {
      const frameworkPath = path.join(appDir, "Contents/Frameworks", ELECTRON_FRAMEWORK);
      rmSync(frameworkPath, { recursive: true });
      // A clone rather than a copy, which on APFS costs nothing. cp keeps extended attributes,
      // which is where codesign puts the signature of a file that is not Mach-O.
      await runCommand("cp", ["-cR", signedFrameworkPaths(privateDir).framework, frameworkPath]);
    }

    if (
      config.macos?.signingCertificate != null &&
      config.targets.includes(DesktopProxyBuildTask.targetName)
    ) {
      await signDesktopProxy(config, appDir);
    }

    if (config.targets.includes(BitwardenMacosAutofillExtensionBuildTask.targetName)) {
      const extensionDir = path.join(
        getBuildDirectories(config, BitwardenMacosAutofillExtensionBuildTask).outputDir,
        "BitwardenAutofillExtension.appex",
      );
      await copyMacOsPlugin(appDir, extensionDir);
    }
  }
}

/// Signs both copies of the proxy, each with the entitlements DesktopProxyBuildTask's configure
/// wrote for it, before electron-builder signs the app. electron-builder is told to leave them
/// alone (`signIgnore` in the base configuration), because it would sign them with the app's
/// inherited entitlements. They take the app's identifier, as the app group they share is named
/// after it.
async function signDesktopProxy(config: BuildConfig, appDir: string) {
  const entitlements = desktopProxyEntitlementsPaths(config);
  for (const [name, entitlementsPath] of [
    ["desktop_proxy", entitlements.desktopProxy],
    ["desktop_proxy.inherit", entitlements.desktopProxyInherit],
  ]) {
    await runCommand("codesign", [
      "--sign",
      config.macos!.signingCertificate!,
      "--identifier",
      config.derived.appId,
      "--force",
      wantsSecureTimestamp(config) ? "--timestamp" : "--timestamp=none",
      "--options",
      "runtime",
      "--entitlements",
      entitlementsPath,
      path.join(appDir, "Contents/MacOS", name),
    ]);
  }
}

async function copyMacOsPlugin(appDir: string, extensionDir: string) {
  // Make PlugIns directory.
  const plugInsPath = path.join(appDir, "Contents/PlugIns");
  mkdirSync(plugInsPath, { recursive: true });

  // Copy extension
  const name = path.basename(extensionDir);
  const output = path.join(plugInsPath, name);
  console.log(output);
  await runCommand("ditto", [extensionDir, output]);
}

async function afterSign(config: BuildConfig, privateDir: string) {
  if (config.macos?.notarize) {
    const appName = config.derived.productName;
    const appPath = path.join(privateDir, config.derived.electronFolder, `${appName}.app`);
    await notarizeMacApp(appPath, config.macos.teamId);
  }
}
async function notarizeMacApp(appPath: string, teamId: string) {
  console.log("### Notarizing " + appPath);
  if (process.env.APP_STORE_CONNECT_TEAM_ISSUER) {
    const appleApiIssuer = process.env.APP_STORE_CONNECT_TEAM_ISSUER;
    const appleApiKey = process.env.APP_STORE_CONNECT_AUTH_KEY_PATH as string;
    const appleApiKeyId = process.env.APP_STORE_CONNECT_AUTH_KEY_ID as string;
    return await notarize({
      tool: "notarytool",
      appPath,
      appleApiIssuer,
      appleApiKey,
      appleApiKeyId,
    });
  } else {
    const appleId = process.env.APPLE_ID_USERNAME || (process.env.APPLEID as string);
    const appleIdPassword = process.env.APPLE_ID_PASSWORD || `@keychain:AC_PASSWORD`;
    return await notarize({
      tool: "notarytool",
      appPath,
      teamId,
      appleId,
      appleIdPassword,
    });
  }
}

export default ElectronBuildTask;
