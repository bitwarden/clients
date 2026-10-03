/// Vocabulary and normalization for the desktop build configuration.
///
/// `configure.mts` turns command line flags into a `build-config.json` that every later build
/// step reads, so that "should this build include the macOS autofill extension?" is answered
/// once, by the caller, instead of being re-derived from arguments and environment by each
/// script and electron-builder hook along the way.
///
/// This module deliberately touches no filesystem, `process`, or `import.meta`, so it stays
/// unit-testable. Anything needing those lives in `configure.mts`.

// Named rather than a default import: this module is the one that gets unit tested, and the
// CommonJS the test transform emits has no default export for a builtin.
import { isAbsolute, relative, resolve, sep } from "path";
import { parseArgs } from "util";

export const CONFIG_VERSION = 2;
export const BUILD_CONFIG_FILENAME = "build-config.json";

/// Layout inside the build directory. Intermediates mirror the path of the source they were
/// built from, relative to `apps/desktop`.
export const INTERMEDIATES_DIR = "intermediates";
export const DIST_DIR = "dist";
export const APP_SOURCE_DIR = "intermediates/src";

/// The provisioning profile is copied in at configure time rather than built, so it has no
/// source path to mirror. A fixed name keeps it stable whether the caller passed a repo path
/// or the name of an installed profile, whose own file is named by UUID.
export const PROVISIONING_PROFILE_DIR = "intermediates/provisioning";
export const PROVISIONING_PROFILE_FILE = "app.provisionprofile";

/// Entitlements are generated from the configuration rather than checked in, so they land here
/// for the same reason the provisioning profile does: they belong to this build.
export const ENTITLEMENTS_DIR = "intermediates/entitlements";

/// Application identifier per channel. Beta is a separate application -- its own identifier, its
/// own app group and provisioning on macOS, its own identity in the Microsoft Store -- which is
/// why everything named after it is built from this rather than written down once per file.
///
/// electron-builder.beta.json said `com.bitwarden.desktop.beta`, which was a guess that was
/// never registered under that name; `com.bitwarden.beta.desktop` is the identifier beta is
/// actually taking. Changing it means new provisioning profiles and a new app group.
export const APP_IDS: Record<Channel, string> = {
  stable: "com.bitwarden.desktop",
  beta: "com.bitwarden.beta.desktop",
};

/// What the app calls itself. electron-builder uses it for the bundle name, the executable, and
/// every artifact name written as `${productName}`.
export const PRODUCT_NAMES: Record<Channel, string> = {
  stable: "Bitwarden",
  beta: "Bitwarden Beta",
};

export const PLATFORMS = ["macos", "windows", "linux"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const ARCHITECTURES = ["ia32", "x64", "arm64", "universal"] as const;
export type Architecture = (typeof ARCHITECTURES)[number];

const ARCHITECTURE_PLATFORMS: Record<Architecture, readonly Platform[]> = {
  ia32: ["windows"],
  x64: ["macos", "windows", "linux"],
  arm64: ["macos", "windows", "linux"],
  universal: ["macos"],
};

export const CHANNELS = ["stable", "beta"] as const;
export type Channel = (typeof CHANNELS)[number];

/// Cargo profile the native targets are built with. Defaults to debug, matching
/// desktop_native/build.js, so a release build has to be asked for.
export const PROFILES = ["debug", "release"] as const;
export type Profile = (typeof PROFILES)[number];

/// Oldest glibc a cross-built Linux artifact may require. Matches the ubuntu-22.04 runner CI
/// builds Linux on, and the core22 snap base, both glibc 2.35 -- so a cross build runs
/// everywhere a released build does. Only cross builds can honor it; a native Linux build
/// links against whatever the host has.
export const DEFAULT_GLIBC = "2.35";

/// Distribution channels, mapped to the platform they can be produced on. `directory` is the
/// unpacked output and belongs to no single platform.
export const DISTRIBUTION_CHANNELS = {
  dmg: "macos",
  "mac-zip": "macos",
  "mac-app-store": "macos",
  "mac-app-store-development": "macos",
  "windows-installer": "windows",
  "windows-portable": "windows",
  "microsoft-store": "windows",
  "windows-appx": "windows",
  deb: "linux",
  rpm: "linux",
  appimage: "linux",
  snap: "linux",
  flatpak: "linux",
  "linux-tarball": "linux",
  directory: null,
} as const;
export type DistributionChannel = keyof typeof DISTRIBUTION_CHANNELS;

/// An App Store build signs, provisions and sandboxes differently from a directly distributed
/// one. Allowing both in one invocation would leave those choices ambiguous, which is why they
/// are also the channels no other channel can be combined with.
export const APP_STORE_CHANNELS: readonly DistributionChannel[] = [
  "mac-app-store",
  "mac-app-store-development",
];

/// What has to be installed to build a target. Lets configure ask "does this configuration
/// need cargo?" without keeping a second list of which targets are Rust.
export type Toolchain = "rust" | "xcode";

export interface TargetDefinition {
  /// Key used for this target in `build-config.json`.
  readonly key: string;
  readonly toolchain: Toolchain;
  /// Suffix of the `--with-`/`--no-` flag pair, or null for targets that have no flag yet and
  /// are always built when their platform is selected.
  readonly flag: string | null;
  readonly platforms: readonly Platform[];
  readonly enabledByDefault: boolean;
  /// Where the target's output belongs, relative to the intermediates directory. A directory
  /// rather than a file wherever the filename carries `<platform>-<arch>`, since a universal
  /// build produces more than one.
  readonly intermediate: string;
  /// Script that builds it, relative to the scripts directory, so that `bw-task build` does not
  /// keep a second list of targets.
  readonly script: string;
}

export const TARGETS: readonly TargetDefinition[] = [
  {
    key: "macosAutofillExtension",
    toolchain: "xcode",
    flag: "macos-autofill-extension",
    platforms: ["macos"],
    // Opt-in, matching today's scripts: only pack:mac:with-extension, pack:mac:mas and
    // pack:local:mac build it.
    enabledByDefault: false,
    intermediate: "macos/autofill-extension.appex",
    script: "build-macos-autofill-extension.mts",
  },
  {
    key: "desktopProxy",
    toolchain: "rust",
    flag: "desktop-proxy",
    platforms: ["macos", "windows", "linux"],
    enabledByDefault: true,
    intermediate: "desktop_native/proxy",
    script: "build-desktop-proxy.mts",
  },
  {
    key: "windowsPasskeyPlugin",
    toolchain: "rust",
    flag: "windows-passkey-plugin",
    platforms: ["windows"],
    enabledByDefault: true,
    intermediate: "desktop_native/windows_plugin_authenticator",
    script: "build-windows-passkey-plugin.mts",
  },
  {
    key: "chromiumImportHelper",
    toolchain: "rust",
    flag: null,
    platforms: ["windows"],
    enabledByDefault: true,
    intermediate: "desktop_native/bitwarden_chromium_import_helper",
    script: "build-chromium-import-helper.mts",
  },
  {
    key: "processIsolation",
    toolchain: "rust",
    flag: null,
    platforms: ["linux"],
    enabledByDefault: true,
    intermediate: "desktop_native/process_isolation",
    script: "build-process-isolation.mts",
  },
  {
    key: "napi",
    toolchain: "rust",
    flag: null,
    platforms: ["macos", "windows", "linux"],
    enabledByDefault: true,
    intermediate: "desktop_native/napi",
    script: "build-napi.mts",
  },
];

export interface AutofillExtensionBuild {
  xcodeConfiguration: string;
  /// False when the build asked for no signing at all, in which case the identity and profile
  /// below say what it *would* be signed with and nothing uses them.
  signed: boolean;
  codeSignIdentity: string;
  provisioningProfileSpecifier: string;
}

/// The Xcode configuration says how the extension was compiled and nothing about where it is
/// going. The project also has ReleaseAppStore and ReleaseDeveloper, which predate this and
/// name both at once; they are still there for build-macos-extension.js and for anyone
/// building from Xcode, and nothing here selects them.
const AUTOFILL_EXTENSION_CONFIGURATIONS: Record<Profile, string> = {
  debug: "Debug",
  release: "Release",
};

/// How the extension is signed, which follows from where the build is going. Both of these
/// outrank the Xcode configuration's own settings, because xcodebuild ranks a setting given on
/// the command line above both the target's and the .xcconfig's.
interface AutofillExtensionSigning {
  codeSignIdentity: string;
  provisioningProfileSpecifier: string;
}

const AUTOFILL_EXTENSION_SIGNING: Record<string, AutofillExtensionSigning> = {
  "mac-app-store": {
    codeSignIdentity: "3rd Party Mac Developer Application",
    provisioningProfileSpecifier: "Bitwarden Desktop Autofill App Store 2024",
  },
  "mac-app-store-development": {
    codeSignIdentity: "Apple Development",
    provisioningProfileSpecifier: "Bitwarden Desktop Autofill Development 2024",
  },
  default: {
    codeSignIdentity: "Developer ID Application",
    provisioningProfileSpecifier: "Bitwarden Desktop Autofill Extension Developer Dis",
  },
};

export interface RawOptions {
  help: boolean;
  buildDir?: string;
  channel?: string;
  profile?: string;
  glibc?: string;
  skipToolchainCheck: boolean;
  notarize: boolean;
  architectures: string[];
  distributionChannels: string[];
  buildNumber?: string;
  macosSigningCertificate?: string;
  provisioningProfile?: string;
  safariExtension?: string;
  /// Flag suffixes passed as `--with-<suffix>`.
  enabledTargets: string[];
  /// Flag suffixes passed as `--no-<suffix>`.
  disabledTargets: string[];
}

export interface ResolvedInputs {
  /// Display name of the provisioning profile, when it could be read.
  provisioningProfileName?: string;
  /// Safari extension location, already normalized by the caller: POSIX, and relative to
  /// `apps/desktop` when it points inside the repository.
  safariExtensionPath?: string;
}

export interface MacosDerived {
  /// Written by configure, so a build step is handed a file rather than a decision about which
  /// checked-in file to use. Paths are relative to apps/desktop.
  entitlements: MacosEntitlements;
}

/// One entry per thing that gets signed separately. Which document each holds depends on the
/// distribution channel; that choice is configure's, and by the time anything reads this it has
/// been made.
export interface MacosEntitlements {
  app: string;
  /// Applied to the app's child processes.
  appInherit: string;
  /// Absent outside the App Store, which is the only build with a login helper.
  loginHelper?: string;
  /// The native messaging proxy, and the copy of it the app launches itself.
  desktopProxy: string;
  desktopProxyInherit: string;
  /// Absent unless the extension is part of the build.
  autofillExtension?: string;
}

/// Filenames under ENTITLEMENTS_DIR, one per member of MacosEntitlements.
const ENTITLEMENTS_FILES: Record<keyof MacosEntitlements, string> = {
  app: "app.plist",
  appInherit: "app-inherit.plist",
  loginHelper: "login-helper.plist",
  desktopProxy: "desktop-proxy.plist",
  desktopProxyInherit: "desktop-proxy-inherit.plist",
  autofillExtension: "autofill-extension.plist",
};

export interface ProvisioningProfileConfig {
  requested: string;
  name?: string;
  path: string;
}

export interface BuildConfig {
  configVersion: number;
  buildDir: string;
  channel: Channel;
  profile: Profile;
  architectures: Architecture[];
  distributionChannels: DistributionChannel[];
  buildNumber?: string;
  macos?: {
    signingCertificate?: string;
    provisioningProfile?: ProvisioningProfileConfig;
    /// Whether to submit the packaged app to Apple. Off unless asked for: notarization needs
    /// credentials and Apple's servers, and a local build wants neither.
    notarize?: boolean;
  };
  linux?: {
    /// Applied when cross-compiling, where cargo-zigbuild can cap the glibc symbol versions a
    /// binary requires. A native build links against the host's glibc and ignores this.
    glibc: string;
  };
  targets: Record<string, boolean>;
  dependencies: Record<string, { path: string }>;
  derived: {
    platform: Platform;
    /// What the app is called to the operating system, and what it calls itself. Both follow
    /// from the channel, and everything downstream reads them here rather than deciding again.
    appId: string;
    productName: string;
    macos?: MacosDerived;
    macosAutofillExtension?: AutofillExtensionBuild;
  };
  directories: {
    intermediates: string;
    appSource: string;
    dist: string;
  };
  intermediates: Record<string, string>;
}

/// Thrown for anything a caller can fix by changing their command line or their build
/// directory: unknown flags, missing values, a configuration that isn't there. Semantic
/// problems found during validation come back from `validate` as a list instead, so the caller
/// sees all of them at once rather than one per run.
export class BuildError extends Error {}

export function usage(): string {
  const targetFlags = TARGETS.filter((target) => target.flag != null)
    .map((target) => {
      const platforms = target.platforms.join(", ");
      const fallback = target.enabledByDefault ? "enabled" : "disabled";
      return (
        `  --with-${target.flag} / --no-${target.flag}\n` +
        `      ${platforms}; ${fallback} by default`
      );
    })
    .join("\n");

  const option = (flag: string, description: string) => `  ${flag.padEnd(33)} ${description}`;

  return [
    "Usage: bw-task configure --build-dir <dir> [options]",
    "",
    "Writes <build-dir>/build-config.json describing what this build should contain.",
    "",
    "Options:",
    option("--build-dir <dir>", "Build directory, relative to apps/desktop (required)"),
    option(`--channel <${CHANNELS.join("|")}>`, "Release channel (default: stable)"),
    option(
      `--profile <${PROFILES.join("|")}>`,
      "Cargo profile for native targets (default: debug)",
    ),
    option(
      "--glibc <version>",
      `Oldest glibc a Linux cross build may need (default: ${DEFAULT_GLIBC})`,
    ),
    option("--architecture <arch>", `Repeatable. One of: ${ARCHITECTURES.join(", ")}`),
    option("--distribution-channel <channel>", "Repeatable. One of:"),
    `      ${Object.keys(DISTRIBUTION_CHANNELS).join(", ")}`,
    option("--build-number <digits>", "Build number stamped into the app"),
    option("--macos-signing-certificate <id>", "Certificate subject, or 'none' to leave unsigned"),
    option("--notarize", "Submit the packaged app to Apple for notarization"),
    option(
      "--provisioning-profile <path|name>",
      "A file under apps/desktop, or an installed profile",
    ),
    option("--safari-extension <path>", "Prebuilt safari.appex to package"),
    option("--skip-toolchain-check", "Do not probe for cross-compilation prerequisites"),
    option("--help", "Show this message"),
    "",
    "Targets:",
    targetFlags,
  ].join("\n");
}

export function parseConfigureArgs(argv: string[]): RawOptions {
  const options: Record<string, { type: "string" | "boolean"; multiple?: boolean }> = {
    help: { type: "boolean" },
    "build-dir": { type: "string" },
    channel: { type: "string" },
    profile: { type: "string" },
    glibc: { type: "string" },
    "skip-toolchain-check": { type: "boolean" },
    notarize: { type: "boolean" },
    architecture: { type: "string", multiple: true },
    "distribution-channel": { type: "string", multiple: true },
    "build-number": { type: "string" },
    "macos-signing-certificate": { type: "string" },
    "provisioning-profile": { type: "string" },
    "safari-extension": { type: "string" },
  };

  for (const target of TARGETS) {
    if (target.flag == null) {
      continue;
    }
    options[`with-${target.flag}`] = { type: "boolean" };
    options[`no-${target.flag}`] = { type: "boolean" };
  }

  let values: Record<string, unknown>;
  try {
    ({ values } = parseArgs({ args: argv, options, allowPositionals: false }) as {
      values: Record<string, unknown>;
    });
  } catch (error) {
    throw new BuildError(error instanceof Error ? error.message : String(error));
  }

  const enabledTargets: string[] = [];
  const disabledTargets: string[] = [];
  for (const target of TARGETS) {
    if (target.flag == null) {
      continue;
    }
    if (values[`with-${target.flag}`] === true) {
      enabledTargets.push(target.flag);
    }
    if (values[`no-${target.flag}`] === true) {
      disabledTargets.push(target.flag);
    }
  }

  return {
    help: values.help === true,
    buildDir: asString(values["build-dir"]),
    channel: asString(values.channel),
    profile: asString(values.profile),
    glibc: asString(values.glibc),
    skipToolchainCheck: values["skip-toolchain-check"] === true,
    notarize: values.notarize === true,
    architectures: asStringArray(values.architecture),
    distributionChannels: asStringArray(values["distribution-channel"]),
    buildNumber: asString(values["build-number"]),
    macosSigningCertificate: asString(values["macos-signing-certificate"]),
    provisioningProfile: asString(values["provisioning-profile"]),
    safariExtension: asString(values["safari-extension"]),
    enabledTargets,
    disabledTargets,
  };
}

/// Every problem we can see without touching the filesystem, returned together so a caller
/// fixing their command line sees the whole list at once.
export function validate(raw: RawOptions): string[] {
  const errors: string[] = [];

  // The shape of --build-dir is `resolveBuildDir`'s to check; by the time validation runs the
  // caller has already turned it into a path relative to apps/desktop, or reported why it
  // could not.
  if (raw.buildDir == null || raw.buildDir.trim() === "") {
    errors.push("--build-dir is required.");
  }

  if (raw.channel != null && !isChannel(raw.channel)) {
    errors.push(`Unknown --channel '${raw.channel}'. Expected one of: ${CHANNELS.join(", ")}.`);
  }

  if (raw.glibc != null && !/^\d+\.\d+$/.test(raw.glibc)) {
    errors.push(`--glibc must look like 2.35, got '${raw.glibc}'.`);
  }

  if (raw.profile != null && !isProfile(raw.profile)) {
    errors.push(`Unknown --profile '${raw.profile}'. Expected one of: ${PROFILES.join(", ")}.`);
  }

  if (raw.buildNumber != null && !/^\d+$/.test(raw.buildNumber)) {
    errors.push(`--build-number must be digits, got '${raw.buildNumber}'.`);
  }

  for (const architecture of raw.architectures) {
    if (!isArchitecture(architecture)) {
      errors.push(
        `Unknown --architecture '${architecture}'. Expected one of: ${ARCHITECTURES.join(", ")}.`,
      );
    }
  }
  if (raw.architectures.length === 0) {
    errors.push("At least one --architecture is required.");
  }

  for (const channel of raw.distributionChannels) {
    if (!isDistributionChannel(channel)) {
      errors.push(
        `Unknown --distribution-channel '${channel}'. Expected one of: ` +
          `${Object.keys(DISTRIBUTION_CHANNELS).join(", ")}.`,
      );
    }
  }
  if (raw.distributionChannels.length === 0) {
    errors.push("At least one --distribution-channel is required.");
  }

  const distributionChannels = raw.distributionChannels.filter(isDistributionChannel);
  const platforms = platformsOf(distributionChannels);
  if (platforms.length > 1) {
    errors.push(
      `--distribution-channel values span multiple platforms (${platforms.join(", ")}). ` +
        "Configure one platform at a time.",
    );
  }

  for (const exclusive of APP_STORE_CHANNELS) {
    const others = distributionChannels.filter(
      (channel) => channel !== exclusive && channel !== "directory",
    );
    if (distributionChannels.includes(exclusive) && others.length > 0) {
      errors.push(
        `--distribution-channel ${exclusive} cannot be combined with ${others.join(", ")}; ` +
          "they sign and provision differently.",
      );
    }
  }

  const platform = platforms.length === 1 ? platforms[0] : undefined;

  if (platform != null) {
    for (const architecture of raw.architectures.filter(isArchitecture)) {
      if (!ARCHITECTURE_PLATFORMS[architecture].includes(platform)) {
        errors.push(
          `--architecture ${architecture} is not available on ${platform}. Available: ` +
            `${ARCHITECTURES.filter((a) => ARCHITECTURE_PLATFORMS[a].includes(platform)).join(", ")}.`,
        );
      }
    }
  }

  const flags = new Map(TARGETS.filter((t) => t.flag != null).map((t) => [t.flag as string, t]));
  for (const flag of raw.enabledTargets) {
    if (raw.disabledTargets.includes(flag)) {
      errors.push(`--with-${flag} and --no-${flag} are mutually exclusive.`);
      continue;
    }
    const target = flags.get(flag);
    if (platform != null && target != null && !target.platforms.includes(platform)) {
      errors.push(
        `--with-${flag} is not available on ${platform}; it applies to ` +
          `${target.platforms.join(", ")}.`,
      );
    }
  }

  if (platform != null && platform !== "macos") {
    if (raw.safariExtension != null) {
      errors.push(`--safari-extension is only available on macos, not ${platform}.`);
    }
    if (raw.macosSigningCertificate != null) {
      errors.push(`--macos-signing-certificate is only available on macos, not ${platform}.`);
    }
    if (raw.provisioningProfile != null) {
      errors.push(`--provisioning-profile is only available on macos, not ${platform}.`);
    }
  }

  if (platform != null && platform !== "linux" && raw.glibc != null) {
    errors.push(`--glibc is only available on linux, not ${platform}.`);
  }

  // Packaging macOS signs more than the app bundle: the native messaging proxy is signed
  // separately, before electron-builder runs, because `mac.signIgnore` excludes it from
  // electron-builder's own pass and the App Store build needs entitlements of its own on it.
  // So an identity has to be named rather than discovered -- the alternative is picking one out
  // of the keychain and hoping it is the one electron-builder picked for everything else, which
  // is what the packaging hooks used to do.
  if (platform === "macos" && raw.macosSigningCertificate == null) {
    errors.push(
      "Packaging macos requires --macos-signing-certificate, or 'none' to leave the package " +
        "unsigned.",
    );
  }

  if (distributionChannels.includes("mac-app-store") && raw.macosSigningCertificate === "none") {
    errors.push("--distribution-channel mac-app-store cannot be built unsigned.");
  }

  if (raw.notarize) {
    if (platform != null && platform !== "macos") {
      errors.push(`--notarize is only available on macos, not ${platform}.`);
    }
    // Apple notarizes App Store submissions itself, as part of accepting them.
    const appStore = distributionChannels.filter((each) => APP_STORE_CHANNELS.includes(each));
    if (appStore.length > 0) {
      errors.push(
        `--notarize does not apply to ${appStore.join(", ")}; Apple does it on submission.`,
      );
    }
    if (raw.macosSigningCertificate === "none") {
      errors.push("--notarize needs a signed app; --macos-signing-certificate is 'none'.");
    }
  }

  return errors;
}

/// Turns validated options into the file that gets written. Values the caller chose stay in
/// their own sections; anything computed from them lands under `derived`, so a later reader
/// can tell the two apart.
export function toBuildConfig(raw: RawOptions, resolved: ResolvedInputs = {}): BuildConfig {
  const buildDir = normalizeBuildDir(raw.buildDir ?? "");
  const distributionChannels = raw.distributionChannels
    .filter(isDistributionChannel)
    .slice()
    .sort();
  const platform = platformsOf(distributionChannels)[0];
  if (platform == null) {
    throw new BuildError("Cannot build a configuration without a resolved platform.");
  }

  const targets = resolveTargets(raw, platform);
  const autofillExtension = targets.some((target) => target.key === "macosAutofillExtension");
  const macos = macosConfig(raw, resolved, buildDir);
  const profile: Profile = isProfile(raw.profile) ? raw.profile : "debug";
  const channel: Channel = isChannel(raw.channel) ? raw.channel : "stable";

  return {
    configVersion: CONFIG_VERSION,
    buildDir,
    channel,
    profile,
    architectures: raw.architectures.filter(isArchitecture).slice().sort(),
    distributionChannels,
    ...(raw.buildNumber != null ? { buildNumber: raw.buildNumber } : {}),
    ...(macos != null ? { macos } : {}),
    ...(platform === "linux" ? { linux: { glibc: raw.glibc ?? DEFAULT_GLIBC } } : {}),
    targets: Object.fromEntries(targets.map((target) => [target.key, true])),
    dependencies:
      resolved.safariExtensionPath != null
        ? { safariExtension: { path: resolved.safariExtensionPath } }
        : {},
    derived: {
      platform,
      appId: APP_IDS[channel],
      productName: PRODUCT_NAMES[channel],
      ...(platform === "macos"
        ? {
            macos: macosDerived(
              buildDir,
              distributionChannels.some((each) => APP_STORE_CHANNELS.includes(each)),
              autofillExtension,
            ),
          }
        : {}),
      ...(autofillExtension
        ? {
            macosAutofillExtension: autofillExtensionBuild(
              profile,
              distributionChannels,
              raw.macosSigningCertificate,
            ),
          }
        : {}),
    },
    directories: {
      intermediates: join(buildDir, INTERMEDIATES_DIR),
      appSource: join(buildDir, APP_SOURCE_DIR),
      dist: join(buildDir, DIST_DIR),
    },
    intermediates: Object.fromEntries(
      targets.map((target) => [target.key, join(buildDir, INTERMEDIATES_DIR, target.intermediate)]),
    ),
  };
}

function macosConfig(
  raw: RawOptions,
  resolved: ResolvedInputs,
  buildDir: string,
): BuildConfig["macos"] {
  if (raw.macosSigningCertificate == null && raw.provisioningProfile == null && !raw.notarize) {
    return undefined;
  }
  return {
    ...(raw.notarize ? { notarize: true } : {}),
    ...(raw.macosSigningCertificate != null
      ? { signingCertificate: raw.macosSigningCertificate }
      : {}),
    ...(raw.provisioningProfile != null
      ? {
          provisioningProfile: {
            requested: raw.provisioningProfile,
            ...(resolved.provisioningProfileName != null
              ? { name: resolved.provisioningProfileName }
              : {}),
            path: provisioningProfilePath(buildDir),
          },
        }
      : {}),
  };
}

/// Name a target answers to on the command line. Derived from the key rather than stored, so a
/// target cannot be called one thing by `--with-` and another by `bw-task build`.
export function targetName(target: TargetDefinition): string {
  return target.key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export interface BuildDirLocation {
  /// Absolute path, for telling the caller which directory they actually named.
  absolute: string;
  /// POSIX and relative to apps/desktop: what gets recorded, and what every other path in the
  /// configuration is relative to.
  recorded: string;
}

export type BuildDirResolution =
  { ok: true; location: BuildDirLocation } | { ok: false; error: string };

/// Resolves `--build-dir` the way a shell would -- against the caller's working directory --
/// and converts it to the form the configuration records.
///
/// The two are separate on purpose. A developer typing a path means it relative to where they
/// are standing, while the written file has to mean the same thing on a machine whose checkout
/// lives somewhere else, which it only does if its paths are relative to apps/desktop. That is
/// also why a directory outside the repository is refused rather than recorded absolute.
///
/// `cwd` and `projectDir` are expected to be real paths; a symlinked component in one but not
/// the other would make the comparisons below textual nonsense.
export function resolveBuildDir(
  argument: string,
  cwd: string,
  projectDir: string,
  repoRoot: string,
): BuildDirResolution {
  const absolute = resolve(cwd, argument);

  // TODO: allow a build directory outside the repository. It would have to be recorded
  // absolute, since there is nothing to be relative to, which makes that configuration
  // machine-specific -- so the recorded form has to say which of the two it is rather than
  // leaving a reader to guess from the leading slash.
  const fromRepoRoot = relative(repoRoot, absolute);
  if (fromRepoRoot === "" || fromRepoRoot.startsWith("..") || isAbsolute(fromRepoRoot)) {
    return {
      ok: false,
      error:
        `--build-dir '${argument}' resolves to ${absolute}, which is not inside the ` +
        `repository at ${repoRoot}. Build directories live in the checkout, so that ` +
        "build-config.json can name what it contains relative to apps/desktop.",
    };
  }

  if (relative(projectDir, absolute) === "") {
    return {
      ok: false,
      error:
        `--build-dir '${argument}' resolves to ${absolute}, which is apps/desktop itself. ` +
        "The build directory holds everything a build produces, so it has to be a directory " +
        "of its own.",
    };
  }

  return {
    ok: true,
    location: {
      absolute,
      recorded: relative(projectDir, absolute).split(sep).join("/"),
    },
  };
}

/// Whether this build is going to the App Store, which decides how it is signed and whether it
/// is sandboxed. Asked in enough places to be worth having one answer.
export function isAppStoreBuild(config: BuildConfig): boolean {
  return config.distributionChannels.some((channel) => APP_STORE_CHANNELS.includes(channel));
}

export function targetByKey(key: string): TargetDefinition | undefined {
  return TARGETS.find((target) => target.key === key);
}

/// Definitions of the targets a written configuration turned on, for callers that need more
/// than the key -- which toolchain they need, where their output goes.
export function enabledTargetDefinitions(config: BuildConfig): TargetDefinition[] {
  return TARGETS.filter((target) => config.targets[target.key] === true);
}

function macosDerived(
  buildDir: string,
  appStore: boolean,
  autofillExtension: boolean,
): MacosDerived {
  const entitlement = (key: keyof MacosEntitlements) =>
    join(buildDir, ENTITLEMENTS_DIR, ENTITLEMENTS_FILES[key]);

  return {
    entitlements: {
      app: entitlement("app"),
      appInherit: entitlement("appInherit"),
      desktopProxy: entitlement("desktopProxy"),
      desktopProxyInherit: entitlement("desktopProxyInherit"),
      ...(appStore ? { loginHelper: entitlement("loginHelper") } : {}),
      ...(autofillExtension ? { autofillExtension: entitlement("autofillExtension") } : {}),
    },
  };
}

export function provisioningProfilePath(buildDir: string): string {
  return join(normalizeBuildDir(buildDir), PROVISIONING_PROFILE_DIR, PROVISIONING_PROFILE_FILE);
}

/// Serialized the same way every time, so that comparing two configurations is a string
/// comparison and a future change-detection step has something stable to hash.
export function serializeBuildConfig(config: BuildConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

/// Dotted paths of every leaf that differs, for reporting what a reconfigure changed.
export function diffKeys(before: unknown, after: unknown, prefix = ""): string[] {
  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys]
      .sort()
      .flatMap((key) =>
        diffKeys(before[key], after[key], prefix === "" ? key : `${prefix}.${key}`),
      );
  }
  return JSON.stringify(before) === JSON.stringify(after) ? [] : [prefix];
}

function resolveTargets(raw: RawOptions, platform: Platform): TargetDefinition[] {
  return TARGETS.filter((target) => {
    if (!target.platforms.includes(platform)) {
      return false;
    }
    if (target.flag == null) {
      return target.enabledByDefault;
    }
    if (raw.disabledTargets.includes(target.flag)) {
      return false;
    }
    if (raw.enabledTargets.includes(target.flag)) {
      return true;
    }
    return target.enabledByDefault;
  });
}

function autofillExtensionBuild(
  profile: Profile,
  distributionChannels: readonly DistributionChannel[],
  signingCertificate: string | undefined,
): AutofillExtensionBuild {
  return {
    xcodeConfiguration: AUTOFILL_EXTENSION_CONFIGURATIONS[profile],
    // `--macos-signing-certificate none` is a statement about the build, not about the app
    // bundle in it. An extension signed with a Developer ID inside an unsigned app would be an
    // odd thing to have produced, and on a machine holding no such certificate the build would
    // simply fail.
    signed: signingCertificate !== "none",
    ...autofillExtensionSigning(distributionChannels),
  };
}

function autofillExtensionSigning(
  distributionChannels: readonly DistributionChannel[],
): AutofillExtensionSigning {
  for (const channel of distributionChannels) {
    const signing = AUTOFILL_EXTENSION_SIGNING[channel];
    if (signing != null) {
      return signing;
    }
  }
  return AUTOFILL_EXTENSION_SIGNING.default;
}

function platformsOf(distributionChannels: readonly DistributionChannel[]): Platform[] {
  const platforms = new Set<Platform>();
  for (const channel of distributionChannels) {
    const platform = DISTRIBUTION_CHANNELS[channel];
    if (platform != null) {
      platforms.add(platform);
    }
  }
  return [...platforms];
}

function normalizeBuildDir(buildDir: string): string {
  return buildDir.replace(/\\/g, "/").replace(/\/+$/, "");
}

function join(...segments: string[]): string {
  return segments.filter((segment) => segment !== "").join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChannel(value: string | undefined): value is Channel {
  return value != null && (CHANNELS as readonly string[]).includes(value);
}

function isProfile(value: string | undefined): value is Profile {
  return value != null && (PROFILES as readonly string[]).includes(value);
}

function isArchitecture(value: string): value is Architecture {
  return (ARCHITECTURES as readonly string[]).includes(value);
}

function isDistributionChannel(value: string): value is DistributionChannel {
  return Object.prototype.hasOwnProperty.call(DISTRIBUTION_CHANNELS, value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
