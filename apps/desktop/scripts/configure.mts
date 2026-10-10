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
///   node scripts/configure.mts --build-dir build-mac \
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
  statSync,
  writeFileSync,
} from "fs";
import { homedir } from "os";
import path from "path";

import {
  BUILD_CONFIG_FILENAME,
  ConfigureError,
  DIST_DIR,
  INTERMEDIATES_DIR,
  type BuildConfig,
  type ResolvedInputs,
  type RawOptions,
  diffKeys,
  parseConfigureArgs,
  provisioningProfilePath,
  serializeBuildConfig,
  toBuildConfig,
  usage,
  validate,
} from "./build-config.mts";

const projectDir = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(projectDir, "../..");

/// Where macOS keeps installed provisioning profiles. Xcode 16 writes to the first; the CI
/// workflow installs into the second.
const PROFILE_SEARCH_DIRS = [
  path.join(homedir(), "Library/Developer/Xcode/UserData/Provisioning Profiles"),
  path.join(homedir(), "Library/MobileDevice/Provisioning Profiles"),
];

function main(): void {
  const raw = parseConfigureArgs(process.argv.slice(2));

  if (raw.help) {
    console.log(usage());
    return;
  }

  // Filesystem checks run only once the options themselves make sense, so that a typo in a
  // distribution channel doesn't also produce a confusing "profile not found".
  const optionErrors = validate(raw);
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
  const buildDir = path.resolve(projectDir, config.buildDir);
  const configPath = path.join(buildDir, BUILD_CONFIG_FILENAME);

  warnAboutChanges(configPath, config);

  mkdirSync(path.join(buildDir, INTERMEDIATES_DIR), { recursive: true });
  mkdirSync(path.join(buildDir, DIST_DIR), { recursive: true });

  if (resolution.profileSource != null) {
    const destination = path.resolve(projectDir, provisioningProfilePath(config.buildDir));
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(resolution.profileSource, destination);
  }

  writeFileSync(configPath, serializeBuildConfig(config));
  summarize(config, configPath);
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
      throw new ConfigureError(`--provisioning-profile '${requested}' does not exist.`);
    }
    return { sourcePath, name: readProfileName(sourcePath) };
  }

  if (process.platform !== "darwin") {
    throw new ConfigureError(
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

  throw new ConfigureError(
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

function warnAboutChanges(configPath: string, config: BuildConfig): void {
  if (!existsSync(configPath)) {
    return;
  }
  let previous: unknown;
  try {
    previous = JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    console.warn(`warning: ${configPath} was unreadable and will be replaced.`);
    return;
  }
  const changed = diffKeys(previous, config);
  if (changed.length === 0) {
    return;
  }
  console.warn(
    `warning: reconfiguring an existing build directory. Changed: ${changed.join(", ")}.\n` +
      "warning: artifacts already built there were produced under the previous configuration.",
  );
}

function summarize(config: BuildConfig, configPath: string): void {
  const targets = Object.keys(config.targets);
  const dependencies = Object.keys(config.dependencies);
  console.log(`Wrote ${path.relative(projectDir, configPath)}`);
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
  if (error instanceof ConfigureError) {
    console.error(`error: ${error.message}`);
    console.error("\nRun with --help for usage.");
    process.exitCode = 1;
  } else {
    throw error;
  }
}
