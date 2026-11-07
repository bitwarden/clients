/* eslint-disable no-console */

/// Build the macOS autofill extension.
///
/// The extension is an AutoFill Credential Provider that lets macOS offer Bitwarden passwords
/// and passkeys to any app, not just the browser. It is the one native target that is not a
/// cargo build: an Xcode project that links a Rust static library through a generated Swift
/// binding, signed at build time with its own identity and provisioning profile.
///
/// The Xcode configuration follows from the profile, and the identity, provisioning profile
/// and entitlements follow from the distribution channel. configure worked all of that out
/// already and wrote it to `derived.macosAutofillExtension`, so this reads a decision instead
/// of making one -- compare scripts/build-macos-extension.js, which infers a configuration
/// that means both at once from a positional argument.
///
/// Usage:
///   node scripts/build-macos-autofill-extension.mts --build-dir build-mac

import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "fs";
import path from "path";

import { type BuildConfig, BuildError } from "./build-config.mts";
import {
  intermediatePath,
  loadBuildConfig,
  parseBuildArgs,
  projectDir,
  runCommand,
  runScript,
  stageBundle,
} from "./build-support.mts";
import { rustTargetsFor } from "./rust-targets.mts";

const TARGET_KEY = "macosAutofillExtension";
const BUNDLE = "autofill-extension.appex";
const XCODE_PROJECT = "macos/desktop.xcodeproj";
/// Where the Xcode project leaves its output, per configuration.
const XCODE_BUILD_DIR = "macos/build";

/// The Rust side of the extension. The Xcode project links a static library built from this
/// crate and compiles the Swift bindings generated from it.
const FFI_CRATE = "autofill_provider";
const FFI_CRATE_DIR = "desktop_native/autofill_provider";
const FFI_LIBRARY = "libautofill_provider.a";
const CARGO_TARGET_DIR = "desktop_native/target";
/// Referenced by this path from the Xcode project, and gitignored.
const FFI_XCFRAMEWORK = `${FFI_CRATE_DIR}/BitwardenMacosProviderFFI.xcframework`;
const FFI_WORK_DIR = `${FFI_CRATE_DIR}/tmp`;
/// Where the generated bindings have to land to be part of the Xcode target. Also gitignored.
const SWIFT_BINDINGS_DIR = "macos/autofill-extension";

/// Both darwin triples, always. The Xcode target builds for ARCHS_STANDARD -- arm64 and
/// x86_64 -- so the library it links has to carry both slices whatever architectures the rest
/// of the build was configured for.
const FFI_TARGETS = rustTargetsFor("macos", ["universal"]);

runScript(() => {
  const args = parseBuildArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/build-macos-autofill-extension.mts --build-dir <dir>");
    return;
  }
  build(loadBuildConfig(args.buildDir));
});

/// Builds the Rust library the Xcode project links against and the Swift bindings it compiles.
///
/// This is a port of desktop_native/autofill_provider/build.sh, which is still there for the
/// build:macos-extension:* npm scripts. Two things are different: the cargo profile follows the
/// configuration instead of always being release, and missing rust targets are reported by
/// configure rather than installed here -- build.sh runs `rustup target add` itself, which made
/// it the one build step that changed the toolchain it was building with.
function buildFfi(config: BuildConfig): void {
  const release = config.profile === "release";
  const workDir = path.join(projectDir, FFI_WORK_DIR);
  const xcframework = path.join(projectDir, FFI_XCFRAMEWORK);

  // xcodebuild refuses to overwrite an existing xcframework, and a stale one left behind by a
  // failed run would otherwise be what the Xcode build links.
  rmSync(xcframework, { recursive: true, force: true });
  rmSync(workDir, { recursive: true, force: true });

  for (const target of FFI_TARGETS) {
    runCommand(
      "cargo",
      [
        "build",
        "--package",
        FFI_CRATE,
        "--target",
        target,
        "--features",
        "uniffi",
        ...(release ? ["--release"] : []),
      ],
      { cwd: FFI_CRATE_DIR },
    );
  }

  const libraries = FFI_TARGETS.map((target) =>
    path.join(projectDir, CARGO_TARGET_DIR, target, release ? "release" : "debug", FFI_LIBRARY),
  );

  const universal = path.join(workDir, FFI_LIBRARY);
  mkdirSync(workDir, { recursive: true });
  runCommand("lipo", ["-create", ...libraries, "-output", universal]);

  // uniffi reads the interface out of metadata the crate embeds in the compiled library, which
  // is why this runs against a build output rather than the source.
  const bindingsDir = path.join(workDir, "bindings");
  runCommand(
    "cargo",
    [
      "run",
      "--bin",
      "uniffi-bindgen",
      "--features",
      "uniffi/cli",
      "generate",
      libraries[0],
      "--library",
      "--language",
      "swift",
      "--no-format",
      "--out-dir",
      bindingsDir,
    ],
    { cwd: FFI_CRATE_DIR },
  );

  collectBindings(bindingsDir, workDir);

  runCommand("xcodebuild", [
    "-create-xcframework",
    "-library",
    universal,
    "-headers",
    path.join(workDir, "Headers"),
    "-output",
    xcframework,
  ]);

  rmSync(workDir, { recursive: true, force: true });
}

/// Sorts what uniffi generated into the two places it has to be: the Swift goes into the Xcode
/// target's source directory, and the C headers into a directory shaped the way
/// -create-xcframework wants, with every module map concatenated into one.
function collectBindings(bindingsDir: string, workDir: string): void {
  const headersDir = path.join(workDir, "Headers");
  const swiftDir = path.join(projectDir, SWIFT_BINDINGS_DIR);
  mkdirSync(headersDir, { recursive: true });
  mkdirSync(swiftDir, { recursive: true });

  const generated = readdirSync(bindingsDir);
  const withExtension = (extension: string) =>
    generated.filter((file) => path.extname(file) === extension);

  for (const file of withExtension(".swift")) {
    renameSync(path.join(bindingsDir, file), path.join(swiftDir, file));
  }
  for (const file of withExtension(".h")) {
    renameSync(path.join(bindingsDir, file), path.join(headersDir, file));
  }

  const moduleMaps = withExtension(".modulemap");
  if (moduleMaps.length === 0) {
    throw new BuildError(`uniffi generated no module map in ${bindingsDir}.`);
  }
  writeFileSync(
    path.join(headersDir, "module.modulemap"),
    moduleMaps.map((file) => readFileSync(path.join(bindingsDir, file), "utf8")).join(""),
  );
}

function build(config: BuildConfig): void {
  if (config.targets[TARGET_KEY] !== true) {
    console.log(`The autofill extension is not part of this configuration, nothing to build.`);
    return;
  }

  if (process.platform !== "darwin") {
    throw new BuildError(
      `The autofill extension needs Xcode; it cannot be built on ${process.platform}.`,
    );
  }

  const settings = config.derived.macosAutofillExtension;
  if (settings == null) {
    throw new BuildError(
      "The configuration enables the autofill extension but says nothing about how to build " +
        "it. Reconfigure the build directory.",
    );
  }

  console.log(`Building the autofill extension (${settings.xcodeConfiguration})`);

  buildFfi(config);

  // Stale output from an earlier configuration would otherwise be picked up as this one's.
  rmSync(path.join(projectDir, XCODE_BUILD_DIR), { recursive: true, force: true });

  const entitlements = config.derived.macos?.entitlements.autofillExtension;
  if (entitlements == null) {
    throw new BuildError(
      "The configuration enables the autofill extension but generated no entitlements for it. " +
        "Reconfigure the build directory.",
    );
  }

  runCommand("xcodebuild", [
    "-project",
    XCODE_PROJECT,
    "-alltargets",
    "-configuration",
    settings.xcodeConfiguration,
    "CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO",
    // Carried over verbatim from build-macos-extension.js, quotes included.
    "OTHER_CODE_SIGN_FLAGS='--timestamp'",
    // Passed rather than left to the configuration. A setting given on the command line
    // outranks both the target's own build settings and the .xcconfig behind them -- which is
    // the only reason these take effect at all, since the autofill-extension target sets its
    // own CODE_SIGN_IDENTITY and so the .xcconfig values never win on their own.
    `CODE_SIGN_IDENTITY=${settings.codeSignIdentity}`,
    `PROVISIONING_PROFILE_SPECIFIER=${settings.provisioningProfileSpecifier}`,
    // Absolute, because xcodebuild resolves this against the Xcode project's directory while
    // the configuration names it relative to apps/desktop.
    `CODE_SIGN_ENTITLEMENTS=${path.resolve(projectDir, entitlements)}`,
  ]);

  stageBundle(
    path.join(projectDir, XCODE_BUILD_DIR, settings.xcodeConfiguration, BUNDLE),
    intermediatePath(config, TARGET_KEY),
  );

  // macOS registers app extensions it finds anywhere on disk, and would load this copy in
  // preference to the one inside Bitwarden.app. Leaving it behind makes the packaged extension
  // untestable.
  rmSync(path.join(projectDir, XCODE_BUILD_DIR), { recursive: true, force: true });
}
