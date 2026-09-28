import { readFileSync, mkdirSync, renameSync, existsSync, rmSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
import DesktopProxyBuildTask from "./desktop_native/proxy/build-desktop-proxy.mts";
import NapiBuildTask from "./desktop_native/napi/scripts/build-napi.mts";
import BitwardenMacosAutofillExtensionBuildTask from "./macos/Scripts/build-autofill-extension.mts";

import {
  build as electronBuilder,
  Arch as ElectronArchitecture,
  Platform as ElectronPlatform,
  type Configuration,
  type CliOptions,
} from "electron-builder";
import { notarize } from "@electron/notarize";
import plist from "plist";

const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));

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
    }
  },

  async build(config: BuildConfig, outputDir: string, privateDir: string): Promise<void> {
    const baseConfigPath = path.resolve(SOURCE_DIR, "electron-builder.base.json");
    const baseConfigFile = readFileSync(baseConfigPath, { encoding: "utf-8" });
    const baseConfig = JSON.parse(baseConfigFile);
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
        // A secure timestamp is a round trip to Apple for each of the ~250 files codesign signs,
        // which is most of the signing time. Notarization requires one, and a public build may
        // be notarized or submitted later, but an internal build that is not notarized cannot
        // pass Gatekeeper on another developer's machine anyway, so it has no use for one.
        ...(!config.macos!.notarize && config.audience === "internal" ? { timestamp: "none" } : {}),
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
      config: {
        ...baseConfig,
        files: [...(baseConfig.files ?? []), ...nativeModule(config)],
        asarUnpack: [...(baseConfig.asarUnpack ?? []), "**/desktop_napi.*.node"],
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
          afterPack: () => afterPack(config, privateDir),
          afterSign: () => afterSign(config, privateDir),
        },
        ...macConfig,
        /*
        ...withAbsoluteSigningPaths(resolved),
        ...packHooks(config),
        ...appxManifestHook(config),
        */
      },
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

async function afterPack(config: BuildConfig, privateDir: string) {
  if (config.platform === "macos") {
    const appDir = path.join(
      privateDir,
      config.derived.electronFolder,
      `${config.derived.productName}.app`,
    );

    if (config.targets.includes(BitwardenMacosAutofillExtensionBuildTask.targetName)) {
      const extensionDir = path.join(
        getBuildDirectories(config, BitwardenMacosAutofillExtensionBuildTask).outputDir,
        "BitwardenAutofillExtension.appex",
      );
      await copyMacOsPlugin(appDir, extensionDir);
    }
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
