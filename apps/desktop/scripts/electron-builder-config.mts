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

  // scripts/before-pack.js did this by pushing onto the normalized filter of files[0] through
  // electron-builder's private `_configuration`. It is a file list, so it belongs in the file
  // list. Architecture is deliberately not filtered here: @electron/universal needs every
  // non-asar file present in both per-architecture builds, and `singleArchFiles` sorts them out
  // during the merge.
  result.files = [...asArray(result.files), ...foreignNodeFiles(config)];

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

  applyChannel(result, config);

  if (config.derived.platform === "macos") {
    applyMacIdentity(result, config);
    applyMacSigning(result, config);
  }

  // The hooks are supplied by pack.mts as functions closed over this configuration. Dropping
  // the script paths here only keeps them out of the written file -- electron-builder reads the
  // checked-in configuration itself, so what actually displaces them is pack.mts handing it a
  // function for each of these keys.
  delete result.beforePack;
  delete result.afterPack;
  delete result.afterSign;

  return result;
}

/// What a beta build is called and dressed as.
///
/// The base configuration describes the stable build; this is every way the beta one differs
/// from it. It used to be a second copy of the whole file, electron-builder.beta.json, and a
/// copy drifts: it pinned electronVersion 41.7.2 against the base's 43.2.0, and had no `linux`,
/// `mas`, `deb`, `rpm` or `snap` sections at all, so beta could not be built for Linux or the
/// App Store and shipped a different Electron than the stable build it shadows. Expressed as a
/// difference, none of that can happen -- there is nothing left to fall behind.
///
/// The fork is still on disk: CI and the pack:*:beta npm scripts pass it to electron-builder
/// directly, and it goes when they do.
function applyChannel(result: Record<string, unknown>, config: BuildConfig): void {
  result.appId = config.derived.appId;
  result.productName = config.derived.productName;

  if (config.channel !== "beta") {
    return;
  }

  // The package name, which is what the Linux package managers install and what
  // `${productName}` in the deb, rpm and AppImage artifact names resolves to.
  result.extraMetadata = {
    ...(result.extraMetadata as Record<string, unknown>),
    name: "bitwarden-beta",
  };

  // Beta has its own icons at every size the platforms ask for.
  section(result, "mac", { icon: "icon.beta.icns" });
  section(result, "dmg", { icon: "dmg.beta.icns" });
  section(result, "win", {
    icon: "icon.beta.ico",
    // The native messaging manifest and the logo Windows shows for the plugin authenticator
    // both name the app, so both have a beta copy.
    extraResources: [
      {
        from: "resources/windows_plugin_authenticator_config.beta.json",
        to: "plugin_authenticator_config.json",
      },
      {
        from: "resources/windows_plugin_authenticator_logo.beta.svg",
        to: "plugin_authenticator_logo.svg",
      },
    ],
  });

  // Artifact names, carried over exactly. Note the macOS ones do not say "Beta" -- the
  // installer and portable ones do -- which is how the fork had it.
  section(result, "mac", { artifactName: "Bitwarden-${version}-${arch}-mac.${ext}" });
  section(result, "dmg", { artifactName: "Bitwarden-${version}-${arch}.${ext}" });
  section(result, "nsisWeb", { artifactName: "Bitwarden-Beta-Installer-${version}.${ext}" });
  section(result, "portable", { artifactName: "Bitwarden-Beta-Portable-${version}.${ext}" });

  // A separate application to the Microsoft Store, with its own identity and tile.
  section(result, "appx", {
    applicationId: "BitwardenBeta",
    identityName: "8bitSolutionsLLC.BitwardenBeta",
    backgroundColor: "#FDC700",
    artifactName: "Bitwarden-Beta-${version}-${arch}.${ext}",
    customExtensionsPath: "../custom-appx-extensions.beta.xml",
    minVersion: "10.0.14393.0",
  });
  // The fork also sets `appxManifestCreated`, a hook that edits the generated manifest. It is
  // not here because electron-builder resolves a hook's path against the working directory
  // rather than the project, and eagerly, whatever platform is being built -- so a relative one
  // breaks a macOS build started from anywhere but apps/desktop. pack.mts adds it, absolute,
  // for the Windows builds that have a manifest at all.
}

/// Overlays values onto one section of the configuration, leaving the rest of it alone.
function section(
  result: Record<string, unknown>,
  key: string,
  values: Record<string, unknown>,
): void {
  result[key] = { ...(result[key] as Record<string, unknown>), ...values };
}

/// `.node` addons belonging to a platform this build is not for. They are pulled in by
/// node_modules and would otherwise be packaged on every platform at once.
function foreignNodeFiles(config: BuildConfig): string[] {
  const packaged = { macos: "darwin", windows: "win32", linux: "linux" }[config.derived.platform];

  return ["darwin", "linux", "win32"]
    .filter((platform) => platform !== packaged)
    .flatMap((platform) => [
      `!node_modules/@bitwarden/desktop-napi/desktop_napi.${platform}-*.node`,
      `!node_modules/**/prebuilds/${platform}-*/*.node`,
    ]);
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
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

/// The entitlements are generated from the same application identifier applied to the package,
/// so an app signed with entitlements naming a different identifier -- which is rejected
/// outright -- is not something this can produce.
function applyMacIdentity(result: Record<string, unknown>, config: BuildConfig): void {
  const macos = config.derived.macos;
  if (macos == null) {
    return;
  }

  const appStore = isAppStoreBuild(config);
  const section = appStore ? "mas" : "mac";
  const { entitlements } = macos;

  result[section] = {
    ...(result[section] as Record<string, unknown>),
    entitlements: entitlements.app,
    entitlementsInherit: entitlements.appInherit,
    ...(entitlements.loginHelper != null
      ? { entitlementsLoginHelper: entitlements.loginHelper }
      : {}),
    ...(embeddedExtensions(config).length > 0 ? { signIgnore: embeddedExtensions(config) } : {}),
  };
}

/// Patterns matching the app extensions pack.mts embeds before electron-builder signs.
///
/// They arrive already signed, by Xcode or by whoever built them, with entitlements of their
/// own -- an app group, and the AutoFill credential provider. Without this they would not be
/// left alone: @electron/osx-sign walks the bundle and re-signs every Mach-O it finds, and it
/// only recognises `.app` and `.framework` directories as bundles, so an `.appex` is descended
/// into and its executable signed loose, with the app's inherited entitlements in place of the
/// extension's own.
///
/// The app itself is signed last and after these are already in place, so its seal covers them.
function embeddedExtensions(config: BuildConfig): string[] {
  const patterns: string[] = [];
  if (config.targets.macosAutofillExtension === true) {
    patterns.push("autofill-extension\\.appex");
  }
  if (config.dependencies.safariExtension != null) {
    patterns.push("safari\\.appex");
  }
  return patterns;
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
