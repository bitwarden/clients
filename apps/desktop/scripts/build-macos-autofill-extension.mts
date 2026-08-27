/* eslint-disable no-console */

/// Build the macOS autofill extension.
///
/// The extension is an AutoFill Credential Provider that lets macOS offer Bitwarden passwords
/// and passkeys to any app, not just the browser. It is the one native target that is not a
/// cargo build: an Xcode project that links a Rust static library through a generated Swift
/// binding, signed at build time with its own identity and provisioning profile.
///
/// Which of the three Xcode configurations to use, and the identity and profile that go with
/// it, follow from the distribution channel. configure worked that out already and wrote it to
/// `derived.macosAutofillExtension`, so this reads a decision instead of making one -- compare
/// scripts/build-macos-extension.js, which infers it from a positional argument.
///
/// Usage:
///   node scripts/build-macos-autofill-extension.mts --build-dir build-mac

import { rmSync } from "fs";
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

const TARGET_KEY = "macosAutofillExtension";
const BUNDLE = "autofill-extension.appex";
const XCODE_PROJECT = "macos/desktop.xcodeproj";
/// Where the Xcode project leaves its output, per configuration.
const XCODE_BUILD_DIR = "macos/build";
/// Builds the Rust side: a universal static library, the generated Swift bindings the Xcode
/// project compiles against, and the xcframework wrapping them. Paired with the Xcode build in
/// the build:macos-extension:* npm scripts, and kept paired here.
const FFI_BUILD_SCRIPT = "desktop_native/autofill_provider/build.sh";

runScript(() => {
  const args = parseBuildArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/build-macos-autofill-extension.mts --build-dir <dir>");
    return;
  }
  build(loadBuildConfig(args.buildDir));
});

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

  // The Rust library the Xcode project links against, and the Swift bindings it compiles.
  runCommand(path.join(projectDir, FFI_BUILD_SCRIPT), []);

  // Stale output from an earlier configuration would otherwise be picked up as this one's.
  rmSync(path.join(projectDir, XCODE_BUILD_DIR), { recursive: true, force: true });

  runCommand("xcodebuild", [
    "-project",
    XCODE_PROJECT,
    "-alltargets",
    "-configuration",
    settings.xcodeConfiguration,
    "CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO",
    // Carried over verbatim from build-macos-extension.js, quotes included.
    "OTHER_CODE_SIGN_FLAGS='--timestamp'",
    // Xcode has a bug that requires these on the command line even though the .xcconfig for
    // each configuration already sets them.
    `CODE_SIGN_IDENTITY=${settings.codeSignIdentity}`,
    `PROVISIONING_PROFILE_SPECIFIER=${settings.provisioningProfileSpecifier}`,
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
