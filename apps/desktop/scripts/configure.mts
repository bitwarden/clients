/* eslint-disable no-console */

/// Configure a desktop build.
///
/// Records what a build should contain -- which optional components, for which architectures,
/// aimed at which distribution channels -- in `<build-dir>/build-config.json`. Later steps
/// read that file rather than each deciding for itself from flags and environment variables,
/// so the caller (a developer, or a CI job) owns the decision in one place.
///
/// Everything a build produces lives under the chosen build directory. Intermediates mirror
/// the path of the source they were built from, relative to `apps/desktop`, so a job that
/// needs an artifact from an earlier job stages it at the path this file names.
///
/// Usage:
///   bw-task configure --build-dir build-mac \
///     --architecture universal --distribution-channel dmg \
///     --with-macos-autofill-extension \
///     --macos-signing-certificate "Developer ID Application: Bitwarden Inc" \
///     --provisioning-profile bitwarden_desktop_developer_id.provisionprofile
///
/// Run with --help for the full option list.

import { execFileSync } from "child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { homedir } from "os";
import path from "path";

import { staleArtifacts } from "./artifacts.mts";
import {
  BUILD_CONFIG_FILENAME,
  BuildError,
  CONFIG_VERSION,
  DIST_DIR,
  INTERMEDIATES_DIR,
  type BuildConfig,
  type ResolvedInputs,
  type RawOptions,
  type BuildDirLocation,
  diffKeys,
  enabledTargetDefinitions,
  isAppStoreBuild,
  parseConfigureArgs,
  provisioningProfilePath,
  resolveBuildDir,
  serializeBuildConfig,
  toBuildConfig,
  usage,
  validate,
} from "./build-config.mts";
import {
  autofillExtensionEntitlements,
  macAppEntitlements,
  masAppEntitlements,
  serializePlist,
} from "./entitlements.mts";
import {
  type RustTarget,
  asHostPlatform,
  crossCompilationPlan,
  rustTargetsFor,
} from "./rust-targets.mts";
import { type ToolchainReport, verifyToolchain, verifyXcode } from "./toolchain.mts";

const projectDir = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(projectDir, "../..");

/// Where macOS keeps installed provisioning profiles. Xcode 16 writes to the first; the CI
/// workflow installs into the second.
const PROFILE_SEARCH_DIRS = [
  path.join(homedir(), "Library/Developer/Xcode/UserData/Provisioning Profiles"),
  path.join(homedir(), "Library/MobileDevice/Provisioning Profiles"),
];

function main(): void {
  const parsed = parseConfigureArgs(process.argv.slice(2));

  if (parsed.help) {
    console.log(usage());
    return;
  }

  // --build-dir is what the caller typed, which means whatever it would mean to their shell.
  // Everything downstream wants it relative to apps/desktop, so it is converted here, once,
  // before anything looks at it.
  const located = locateBuildDir(parsed);
  const raw = located.raw;

  // Filesystem checks run only once the options themselves make sense, so that a typo in a
  // distribution channel doesn't also produce a confusing "profile not found".
  const optionErrors = [...located.errors, ...validate(raw)];
  const resolution = optionErrors.length === 0 ? resolveInputs(raw) : emptyResolution();
  const errors = [...optionErrors, ...resolution.errors];

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`error: ${error}`);
    }
    console.error("\nRun with --help for usage.");
    process.exitCode = 1;
    return;
  }

  const config = toBuildConfig(raw, resolution.inputs);

  // Probed here rather than installed at build time: a machine that cannot finish this build
  // should say so now, while the only thing lost is the time it took to ask.
  if (!raw.skipToolchainCheck && !toolchainIsReady(config)) {
    process.exitCode = 1;
    return;
  }

  const buildDir = located.location?.absolute ?? path.resolve(projectDir, config.buildDir);
  const configPath = path.join(buildDir, BUILD_CONFIG_FILENAME);

  invalidateStaleArtifacts(buildDir, configPath, config);

  mkdirSync(path.join(buildDir, INTERMEDIATES_DIR), { recursive: true });
  mkdirSync(path.join(buildDir, DIST_DIR), { recursive: true });

  if (resolution.profileSource != null) {
    const destination = path.resolve(projectDir, provisioningProfilePath(config.buildDir));
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(resolution.profileSource, destination);
  }

  writeEntitlements(config);

  writeFileSync(configPath, serializeBuildConfig(config));
  summarize(config, configPath);
}

/// Entitlements are what the signature actually grants, so they are written from the
/// configuration rather than picked from a set of checked-in near-copies. The AutoFill
/// credential provider entitlement is claimed only when the extension is part of the build:
/// nothing else in the app uses it, and an entitlement in the file is one the binary has.
function writeEntitlements(config: BuildConfig): void {
  const macos = config.derived.macos;
  if (macos == null) {
    return;
  }

  const options = {
    bundleId: macos.bundleId,
    autofill: config.targets.macosAutofillExtension === true,
  };

  const write = (relativePath: string, entitlements: Record<string, unknown>) => {
    const destination = path.resolve(projectDir, relativePath);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, serializePlist(entitlements as never));
  };

  // A sandboxed App Store app has to name every capability it needs; a directly distributed
  // one is not sandboxed and names far fewer.
  const app = isAppStoreBuild(config) ? masAppEntitlements(options) : macAppEntitlements(options);
  write(macos.entitlements.app, app);

  if (macos.entitlements.autofillExtension != null) {
    write(macos.entitlements.autofillExtension, autofillExtensionEntitlements(options));
  }
}

function merge(into: ToolchainReport, from: ToolchainReport): void {
  into.errors.push(...from.errors);
  into.warnings.push(...from.warnings);
}

function toolchainIsReady(config: BuildConfig): boolean {
  const host = asHostPlatform(process.platform);
  if (host == null) {
    console.warn(
      `warning: ${process.platform} is not a supported build host; skipping the toolchain check.`,
    );
    return true;
  }

  const enabled = enabledTargetDefinitions(config);
  const report: ToolchainReport = { errors: [], warnings: [] };

  const rustTargets = new Set<RustTarget>();
  if (enabled.some((target) => target.toolchain === "rust")) {
    for (const target of rustTargetsFor(config.derived.platform, config.architectures)) {
      rustTargets.add(target);
    }
  }
  if (enabled.some((target) => target.key === "macosAutofillExtension")) {
    // Not a cargo target itself, but the Xcode project links a universal static library built
    // from the autofill_provider crate, so it needs both darwin triples whatever architectures
    // the app was configured for. build.sh used to `rustup target add` them mid-build.
    for (const target of rustTargetsFor("macos", ["universal"])) {
      rustTargets.add(target);
    }
  }

  if (rustTargets.size > 0) {
    merge(report, verifyToolchain(crossCompilationPlan(host, [...rustTargets])));
  }
  if (enabled.some((target) => target.toolchain === "xcode")) {
    merge(report, verifyXcode());
  }

  for (const warning of report.warnings) {
    console.warn(`warning: ${warning}`);
  }
  for (const error of report.errors) {
    console.error(`error: ${error}`);
  }
  if (report.errors.length > 0) {
    console.error("\nRun with --skip-toolchain-check to write the configuration anyway.");
    return false;
  }
  return true;
}

interface LocatedBuildDir {
  /// The options, with --build-dir rewritten to the form the configuration records. Left as the
  /// caller typed it when it could not be resolved, so validate still reports it as missing if
  /// that is what it is.
  raw: RawOptions;
  location?: BuildDirLocation;
  errors: string[];
}

function locateBuildDir(raw: RawOptions): LocatedBuildDir {
  if (raw.buildDir == null || raw.buildDir.trim() === "") {
    return { raw, errors: [] };
  }

  const resolution = resolveBuildDir(
    raw.buildDir,
    realpathSync(process.cwd()),
    projectDir,
    repoRoot,
  );
  if (!resolution.ok) {
    return { raw, errors: [resolution.error] };
  }

  return {
    raw: { ...raw, buildDir: resolution.location.recorded },
    location: resolution.location,
    errors: [],
  };
}

interface Resolution {
  errors: string[];
  /// What gets recorded in build-config.json.
  inputs: ResolvedInputs;
  /// Where the provisioning profile was found, so main can copy it in once the configuration
  /// is known to be valid. Not part of the written file, which names the copy instead.
  profileSource?: string;
}

function emptyResolution(): Resolution {
  return { errors: [], inputs: {} };
}

function resolveInputs(raw: RawOptions): Resolution {
  const resolution = emptyResolution();
  const { errors, inputs } = resolution;

  if (raw.provisioningProfile != null) {
    try {
      const profile = resolveProvisioningProfile(raw.provisioningProfile);
      resolution.profileSource = profile.sourcePath;
      inputs.provisioningProfileName = profile.name;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (raw.safariExtension != null) {
    const resolvedPath = path.resolve(projectDir, raw.safariExtension);
    if (!existsSync(resolvedPath) || !statSync(resolvedPath).isDirectory()) {
      errors.push(`--safari-extension '${raw.safariExtension}' is not an existing directory.`);
    } else if (path.extname(resolvedPath) !== ".appex") {
      errors.push(`--safari-extension '${raw.safariExtension}' is not an .appex bundle.`);
    } else {
      inputs.safariExtensionPath = recordablePath(resolvedPath);
    }
  }

  return resolution;
}

interface ResolvedProfile {
  sourcePath: string;
  name?: string;
}

/// Accepts either a file under apps/desktop or the name of a profile already installed on the
/// machine. The name form is what xcodebuild's PROVISIONING_PROFILE_SPECIFIER wants, while
/// electron-builder wants a path, so both are resolved to a file here and the name is recorded
/// alongside it.
function resolveProvisioningProfile(requested: string): ResolvedProfile {
  if (looksLikePath(requested)) {
    const sourcePath = path.resolve(projectDir, requested);
    if (!existsSync(sourcePath)) {
      throw new BuildError(`--provisioning-profile '${requested}' does not exist.`);
    }
    return { sourcePath, name: readProfileName(sourcePath) };
  }

  if (process.platform !== "darwin") {
    throw new BuildError(
      `--provisioning-profile '${requested}' looks like an installed profile name, which can ` +
        "only be resolved on macOS. Pass a path instead.",
    );
  }

  for (const directory of PROFILE_SEARCH_DIRS) {
    if (!existsSync(directory)) {
      continue;
    }
    for (const entry of readdirSync(directory)) {
      if (!entry.endsWith(".provisionprofile") && !entry.endsWith(".mobileprovision")) {
        continue;
      }
      const candidate = path.join(directory, entry);
      // Profiles installed by CI are named by UUID, so match that before paying for a decode.
      if (path.basename(entry, path.extname(entry)) === requested) {
        return { sourcePath: candidate, name: readProfileName(candidate) };
      }
      if (readProfileName(candidate) === requested) {
        return { sourcePath: candidate, name: requested };
      }
    }
  }

  throw new BuildError(
    `No installed provisioning profile named '${requested}'. Searched ` +
      `${PROFILE_SEARCH_DIRS.join(" and ")}.`,
  );
}

/// A provisioning profile is a CMS-signed plist, so the display name only becomes readable
/// after decoding. Best effort: on a machine without `security` the name is simply unknown,
/// which costs nothing until something downstream needs the specifier.
function readProfileName(profilePath: string): string | undefined {
  if (process.platform !== "darwin") {
    return undefined;
  }
  let plist: string;
  try {
    plist = execFileSync("security", ["cms", "-D", "-i", profilePath], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
  const match = /<key>Name<\/key>\s*<string>([^<]*)<\/string>/.exec(plist);
  return match == null ? undefined : unescapeXml(match[1]);
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function looksLikePath(value: string): boolean {
  return (
    value.includes("/") ||
    value.includes("\\") ||
    value.endsWith(".provisionprofile") ||
    value.endsWith(".mobileprovision")
  );
}

/// Paths inside the repository are recorded relative to apps/desktop so the file survives
/// being carried between machines whose workspace roots differ.
function recordablePath(absolute: string): string {
  const inRepo = !path.relative(repoRoot, absolute).startsWith("..");
  const recorded = inRepo ? path.relative(projectDir, absolute) : absolute;
  return recorded.split(path.sep).join("/");
}

/// Removes anything the previous configuration built that this one would not accept.
///
/// Runs here, after validation and the toolchain probe have passed and before the new
/// configuration is written: a command line that is going to be rejected must leave the build
/// directory exactly as it found it, because a typo is not a reason to throw away a build.
///
/// Deleting rather than warning, because the alternative is a directory holding a mixture of
/// two configurations, where whether the next pack picks up the stale half depends on which
/// build steps the caller happens to re-run.
function invalidateStaleArtifacts(buildDir: string, configPath: string, config: BuildConfig): void {
  if (!existsSync(configPath)) {
    return;
  }

  let previous: BuildConfig;
  try {
    previous = JSON.parse(readFileSync(configPath, "utf8")) as BuildConfig;
  } catch {
    console.warn(`warning: ${configPath} was unreadable; discarding what it built.`);
    discard(buildDir);
    return;
  }

  // A file some other version of configure wrote does not necessarily mean by `profile` and
  // `intermediates` what this one does, so nothing can be concluded about what its artifacts
  // depend on. Everything it built is suspect.
  if (previous.configVersion !== CONFIG_VERSION) {
    console.warn(
      `warning: ${configPath} was written by configure version ${previous.configVersion}, not ` +
        `${CONFIG_VERSION}; discarding what it built.`,
    );
    discard(buildDir);
    return;
  }

  const changed = diffKeys(previous, config);
  if (changed.length === 0) {
    return;
  }
  console.warn(
    `warning: reconfiguring an existing build directory. Changed: ${changed.join(", ")}.`,
  );

  for (const artifact of staleArtifacts(previous, config)) {
    const absolute = path.resolve(projectDir, artifact.path);
    if (!existsSync(absolute)) {
      continue;
    }
    rmSync(absolute, { recursive: true, force: true });
    console.log(`Removed ${artifact.path} (${artifact.name}: ${artifact.reason})`);
  }
}

/// Everything a build compiles lives under `intermediates`, including the app source, so
/// emptying it is the answer whenever the previous configuration cannot be read closely enough
/// to say which parts of it are still good. `dist` is left alone: it holds finished packages,
/// which are named after what they contain and are the caller's to keep.
function discard(buildDir: string): void {
  rmSync(path.join(buildDir, INTERMEDIATES_DIR), { recursive: true, force: true });
}

function summarize(config: BuildConfig, configPath: string): void {
  const targets = Object.keys(config.targets);
  const dependencies = Object.keys(config.dependencies);
  console.log(`Wrote ${configPath}`);
  console.log(`  build dir:     ${path.dirname(configPath)}`);
  console.log(`  platform:      ${config.derived.platform}`);
  console.log(`  channel:       ${config.channel}`);
  console.log(`  architectures: ${config.architectures.join(", ")}`);
  console.log(`  distribution:  ${config.distributionChannels.join(", ")}`);
  console.log(`  targets:       ${targets.length > 0 ? targets.join(", ") : "(none)"}`);
  console.log(`  dependencies:  ${dependencies.length > 0 ? dependencies.join(", ") : "(none)"}`);
}

try {
  main();
} catch (error) {
  if (error instanceof BuildError) {
    console.error(`error: ${error.message}`);
    console.error("\nRun with --help for usage.");
    process.exitCode = 1;
  } else {
    throw error;
  }
}
