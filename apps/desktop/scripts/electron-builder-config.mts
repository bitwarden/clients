/// Turns a build configuration into an electron-builder configuration.
///
/// The checked-in electron-builder.json stays the base: it holds everything that does not vary
/// per build, like the language lists, snap plugs and installer settings. This module applies
/// what the build configuration decided on top of it -- where the app source and output live,
/// which optional binaries to package, how to sign.
///
/// The base is merged here rather than through electron-builder's own `extends`, because that
/// merge concatenates arrays (see deepAssign in builder-util). An overlay naming `extraFiles`
/// would be appended to the base's, leaving entries that point at binaries this build never
/// staged.
///
/// Pure: the base is passed in, so this is testable without reading anything.

import { type BuildConfig, type DistributionChannel, isAppStoreBuild } from "./build-config.mts";

/// electron-builder target for each distribution channel. Null where producing the channel
/// takes more than an electron-builder target -- those are packaged by steps that do not exist
/// yet.
export const ELECTRON_BUILDER_TARGETS: Record<DistributionChannel, string | null> = {
  dmg: "dmg",
  "mac-zip": "zip",
  "mac-app-store": "mas",
  "mac-app-store-development": "mas-dev",
  "windows-installer": "nsis-web",
  "windows-portable": "portable",
  "microsoft-store": "appx",
  deb: "deb",
  rpm: "rpm",
  appimage: "AppImage",
  snap: "snap",
  directory: "dir",
  // Repackaged from an Appx that electron-builder already produced; see pack-signed-appx.mts.
  "windows-appx": null,
  // Made from the unpacked directory after electron-builder runs.
  "linux-tarball": null,
  // Built by flatpak-builder, not electron-builder.
  flatpak: null,
};

export interface ExtraFile {
  from: string;
  to: string;
}

/// Files copied into the packaged app, keyed by the target that produces them. The `to` paths
/// have to match what the app looks for at runtime, so they are fixed; only `from` follows the
/// configuration.
const PACKAGED_BINARIES: Record<string, (from: string) => ExtraFile[]> = {
  desktopProxyMac: (from) => [
    { from: `${from}/desktop_proxy.\${platform}-\${arch}`, to: "MacOS/desktop_proxy" },
    // Not sandboxed, and signed with inherited entitlements. Same binary, packaged twice.
    { from: `${from}/desktop_proxy.\${platform}-\${arch}`, to: "MacOS/desktop_proxy.inherit" },
  ],
  desktopProxyWindows: (from) => [
    { from: `${from}/desktop_proxy.win32-\${arch}.exe`, to: "desktop_proxy.exe" },
  ],
  desktopProxyLinux: (from) => [
    { from: `${from}/desktop_proxy.\${platform}-\${arch}`, to: "desktop_proxy" },
  ],
  chromiumImportHelper: (from) => [
    {
      from: `${from}/bitwarden_chromium_import_helper.win32-\${arch}.exe`,
      to: "bitwarden_chromium_import_helper.exe",
    },
  ],
  windowsPasskeyPlugin: (from) => [
    {
      from: `${from}/windows_plugin_authenticator.win32-\${arch}.exe`,
      to: "bitwarden_plugin_authenticator.exe",
    },
  ],
  processIsolation: (from) => [
    {
      from: `${from}/libprocess_isolation.\${platform}-\${arch}.so`,
      to: "libprocess_isolation.so",
    },
  ],
};

/// Channels this build asked for that nothing can produce yet.
export function unsupportedChannels(config: BuildConfig): DistributionChannel[] {
  return config.distributionChannels.filter((channel) => ELECTRON_BUILDER_TARGETS[channel] == null);
}

export function electronBuilderTargets(config: BuildConfig): string[] {
  return config.distributionChannels
    .map((channel) => ELECTRON_BUILDER_TARGETS[channel])
    .filter((target): target is string => target != null);
}

/// Applies the build configuration to a copy of the base electron-builder configuration.
export function applyBuildConfig(
  base: Record<string, unknown>,
  config: BuildConfig,
): Record<string, unknown> {
  // The base came from a JSON file, so a round trip is a faithful deep copy and does not
  // depend on structuredClone, which the test environment's jsdom predates.
  const result = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;

  result.directories = {
    ...(result.directories as Record<string, unknown>),
    app: config.directories.appSource,
    output: config.directories.dist,
  };

  if (config.buildNumber != null) {
    result.buildVersion = config.buildNumber;
  }

  const extraFiles = packagedBinaries(config);
  const platformKey = { macos: "mac", windows: "win", linux: "linux" }[config.derived.platform];
  result[platformKey] = { ...(result[platformKey] as Record<string, unknown>), extraFiles };

  if (config.derived.platform === "macos") {
    applyMacIdentity(result, config);
    applyMacSigning(result, config);
  }

  return result;
}

function packagedBinaries(config: BuildConfig): ExtraFile[] {
  const { platform } = config.derived;
  const staged = (target: string) => config.intermediates[target];

  const entries: ExtraFile[] = [];
  const add = (key: string, target: string) => {
    const from = staged(target);
    if (config.targets[target] === true && from != null) {
      entries.push(...PACKAGED_BINARIES[key](from));
    }
  };

  if (platform === "macos") {
    add("desktopProxyMac", "desktopProxy");
  }
  if (platform === "windows") {
    add("desktopProxyWindows", "desktopProxy");
    add("chromiumImportHelper", "chromiumImportHelper");
    add("windowsPasskeyPlugin", "windowsPasskeyPlugin");
  }
  if (platform === "linux") {
    add("desktopProxyLinux", "desktopProxy");
    add("processIsolation", "processIsolation");
  }
  return entries;
}

/// The bundle identifier and the entitlements are generated together from the channel, so
/// applying both from the same place is what keeps them from disagreeing -- an app signed with
/// entitlements naming a different application identifier is rejected outright.
function applyMacIdentity(result: Record<string, unknown>, config: BuildConfig): void {
  const macos = config.derived.macos;
  if (macos == null) {
    return;
  }

  result.appId = macos.bundleId;

  const section = isAppStoreBuild(config) ? "mas" : "mac";
  result[section] = {
    ...(result[section] as Record<string, unknown>),
    entitlements: macos.entitlements.app,
  };
}

function applyMacSigning(result: Record<string, unknown>, config: BuildConfig): void {
  const certificate = config.macos?.signingCertificate;
  const profile = config.macos?.provisioningProfile?.path;
  // App Store builds sign differently: the outer mac identity is disabled and the mas one is
  // used instead, which is what pack:mac:mas and pack:mac:masdev do with -c overrides today.
  const appStore = isAppStoreBuild(config);

  const mac = { ...(result.mac as Record<string, unknown>) };
  const mas = { ...(result.mas as Record<string, unknown>) };

  if (appStore) {
    // The app bundle inside a .pkg is signed by the mas settings, so the outer identity is
    // turned off rather than left to pick something from the keychain.
    mac.identity = null;
    if (certificate != null) {
      mas.identity = certificate === "none" ? null : certificate;
    }
    if (profile != null) {
      mas.provisioningProfile = profile;
    }
    result.mas = mas;
  } else if (certificate != null) {
    mac.identity = certificate === "none" ? null : certificate;
  }

  if (profile != null) {
    mac.provisioningProfile = profile;
  }
  result.mac = mac;
}
