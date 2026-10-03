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

import { relative, sep } from "path";

import {
  type Architecture,
  type BuildConfig,
  type DistributionChannel,
  isAppStoreBuild,
} from "./build-config.mts";

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
  /// Only used by `files` entries, where it selects what to take from `from`.
  filter?: string[];
}

/// Where the native addon lives inside the packaged app, which is where index.js looks for it.
const NAPI_PACKAGE = "node_modules/@bitwarden/desktop-napi";

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

/// Channels produced by a step of our own that runs after electron-builder, rather than by an
/// electron-builder target of their own.
const POST_PROCESSED: readonly DistributionChannel[] = ["windows-appx"];

export function isPostProcessed(channel: DistributionChannel): boolean {
  return POST_PROCESSED.includes(channel);
}

/// Channels this build asked for that nothing can produce yet.
export function unsupportedChannels(config: BuildConfig): DistributionChannel[] {
  return config.distributionChannels.filter(
    (channel) => ELECTRON_BUILDER_TARGETS[channel] == null && !isPostProcessed(channel),
  );
}

export function electronBuilderTargets(config: BuildConfig): string[] {
  const targets = config.distributionChannels
    .map((channel) => ELECTRON_BUILDER_TARGETS[channel])
    .filter((target): target is string => target != null);

  if (targets.length > 0) {
    return targets;
  }

  // A post-processed channel repackages what electron-builder unpacked, so something has to be
  // unpacked even when no other channel asked for it.
  return config.distributionChannels.some(isPostProcessed) ? ["dir"] : [];
}

/// Where electron-builder leaves the unpacked app for an architecture, relative to the output
/// directory. The default architecture goes without a suffix.
export function unpackedDir(architecture: Architecture): string {
  return architecture === "x64" ? "win-unpacked" : `win-${architecture}-unpacked`;
}

/// The configuration for the second electron-builder pass, which repackages an already-built
/// and already-signed app directory as an Appx that names the signing certificate.
///
/// An Appx carries its publisher in the manifest, and signing only succeeds when that publisher
/// is the subject of the certificate signing it. A Store package has to keep the
/// Microsoft-assigned publisher and stay unsigned, so the two cannot be the same package -- one
/// installs for nobody, the other is rejected at ingestion. Hence a second pass rather than a
/// second target: nothing is rebuilt, the app keeps the signatures from the first pass, and
/// only the manifest changes.
export function signedAppxConfig(
  base: Record<string, unknown>,
  config: BuildConfig,
  publisher: string,
): Record<string, unknown> {
  const result = applyBuildConfig(base, config);

  result.appx = {
    ...(result.appx as Record<string, unknown>),
    publisher,
    // The unsuffixed name. The first pass took `-store` for the package that keeps the
    // Microsoft publisher, so this is the one a person downloads and installs.
    artifactName: appxArtifactName(base, config),
  };

  return result;
}

/// `appx.artifactName` as configured, before the Store suffix is applied.
function appxArtifactName(base: Record<string, unknown>, config: BuildConfig): string {
  const appx = applyChannelTo(base, config).appx as Record<string, unknown> | undefined;
  return typeof appx?.artifactName === "string"
    ? appx.artifactName
    : "${productName}-${version}-${arch}.${ext}";
}

/// The channel overlay applied to a copy of the base, for reading a value the overlay may have
/// changed without going through the whole of applyBuildConfig.
function applyChannelTo(
  base: Record<string, unknown>,
  config: BuildConfig,
): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  applyChannel(copy, config);
  return copy;
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
  result.files = [...asArray(result.files), ...foreignNodeFiles(config), ...nativeModule(config)];

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
  applyStoreAppxName(result, config);

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
  section(result, "win", { icon: "icon.beta.ico" });
  // The plugin authenticator's config and logo also have a beta copy, and they are *not* set
  // here. `extraResources` is an array, and electron-builder merges the configuration it reads
  // itself with the one we pass by concatenating arrays -- so naming the beta files here does
  // not replace the base's, it appends to them. Both then copy to the same destination and the
  // result is whichever landed last, over the top of the other without truncating: a file that
  // is neither channel's and is not valid JSON. pack-hooks.mts copies them instead, after
  // electron-builder has finished putting the stable ones there.

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
    // The file configure generated for this channel, relative to apps/desktop like every other
    // path here. The fork named a checked-in `../custom-appx-extensions.beta.xml`, which
    // electron-builder resolves against `directories.app` -- so it was right only while the app
    // directory was apps/desktop/build. pack.mts makes this absolute, so where it is resolved
    // from stops mattering.
    ...(config.derived.windows?.appxExtensions != null
      ? { customExtensionsPath: config.derived.windows.appxExtensions }
      : {}),
    minVersion: "10.0.14393.0",
  });
  // The fork also sets `appxManifestCreated`, a hook that edits the generated manifest. It is
  // not here because electron-builder resolves a hook's path against the working directory
  // rather than the project, and eagerly, whatever platform is being built -- so a relative one
  // breaks a macOS build started from anywhere but apps/desktop. pack.mts adds it, absolute,
  // for the Windows builds that have a manifest at all.
}

/// Renames the Store Appx when a signed one is being built alongside it.
///
/// Both are Appx packages of the same app for the same architecture, so they land on the same
/// `appx.artifactName` and the second would overwrite the first. The Store package takes the
/// suffix because the signed one is what a person downloads by name. CI renames these by hand
/// today, between the two packaging steps.
function applyStoreAppxName(result: Record<string, unknown>, config: BuildConfig): void {
  const channels = config.distributionChannels;
  if (!channels.includes("microsoft-store") || !channels.includes("windows-appx")) {
    return;
  }

  const appx = { ...(result.appx as Record<string, unknown>) };
  const name = typeof appx.artifactName === "string" ? appx.artifactName : null;
  if (name != null) {
    appx.artifactName = name.replace(/\.\$\{ext\}$/, "-store.${ext}");
    result.appx = appx;
  }
}

/// Overlays values onto one section of the configuration, leaving the rest of it alone.
function section(
  result: Record<string, unknown>,
  key: string,
  values: Record<string, unknown>,
): void {
  result[key] = { ...(result[key] as Record<string, unknown>), ...values };
}

/// The native Node addon, taken from what this build staged rather than from the copy in the
/// crate directory.
///
/// `@bitwarden/desktop-napi` is a `file:` dependency pointing at desktop_native/napi, so
/// electron-builder collects the package -- index.js and the type declarations -- out of
/// node_modules, and the `.node` files it finds there are whatever was compiled into the crate
/// directory last. That is not necessarily this build: napi-rs leaves a copy there as a side
/// effect of every build, so packaging one configuration after building another would ship the
/// other one's module, with no sign that it had.
///
/// So the collected `.node` files are dropped and the staged ones put in their place. The
/// package around them still comes from node_modules; only the compiled artifact is this
/// build's. Destination paths are unchanged, which is what keeps `singleArchFiles` and
/// `x64ArchFiles` -- the universal merge's account of which files exist in only one
/// architecture -- still pointing at the right thing.
function nativeModule(config: BuildConfig): (string | ExtraFile)[] {
  const staged = config.intermediates.napi;
  if (config.targets.napi !== true || staged == null) {
    return [];
  }

  return [
    `!${NAPI_PACKAGE}/*.node`,
    {
      // `files` resolves a relative `from` against the app directory.
      from: posix(relative(config.directories.appSource, staged)),
      to: NAPI_PACKAGE,
      filter: ["*.node"],
    },
  ];
}

function posix(value: string): string {
  return value.split(sep).join("/");
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
