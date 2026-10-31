/* eslint-disable no-console */

/// Build the native Node module.
///
/// desktop_napi is the N-API addon the Electron main process loads for everything it cannot do
/// from JavaScript: biometrics, the OS keychain, clipboard, SSH agent, autotype. Unlike the
/// other native targets it is not built by cargo directly -- napi-rs drives cargo, then names
/// the module after the platform triple, because desktop_native/napi/index.js picks the file
/// to require from `process.platform` and `process.arch` at runtime.
///
/// napi-rs is used through its API rather than its CLI, so the name it chose comes back as a
/// path instead of having to be predicted here.
///
/// Usage:
///   node scripts/build-napi.mts --build-dir build-mac

import path from "path";

// TODO: @napi-rs/cli is declared in desktop_native/napi/package.json and reaches this import
// only because npm hoists it to the workspace root. Declaring it where it is used -- as a
// devDependency of apps/desktop -- would make the resolution real rather than incidental.
// Deliberately deferred: it changes the dependency manifest the existing build system installs
// from, and that system is not being touched yet.
import { NapiCli } from "@napi-rs/cli";

import { type BuildConfig, BuildError } from "./build-config.mts";
import {
  intermediatePath,
  loadBuildConfig,
  parseBuildArgs,
  projectDir,
  runScript,
  stageArtifact,
} from "./build-support.mts";
import {
  type HostPlatform,
  type NodeArch,
  type RustTarget,
  asHostPlatform,
  asNodeArch,
  buildEnv,
  isCrossPlatform,
  rustTargetsFor,
} from "./rust-targets.mts";

const TARGET_KEY = "napi";
const CRATE_DIR = "desktop_native/napi";
const MODULE_NAME = "desktop_napi";

runScript(async () => {
  const args = parseBuildArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/build-napi.mts --build-dir <dir>");
    return;
  }
  await build(loadBuildConfig(args.buildDir));
});

async function build(config: BuildConfig): Promise<void> {
  if (config.targets[TARGET_KEY] !== true) {
    console.log(`${MODULE_NAME} is not part of this configuration, nothing to build.`);
    return;
  }

  const host = asHostPlatform(process.platform);
  const hostArch = asNodeArch(process.arch);
  if (host == null || hostArch == null) {
    throw new BuildError(`${process.platform}/${process.arch} is not a supported build host.`);
  }

  const targets = rustTargetsFor(config.derived.platform, config.architectures);
  console.log(`Building ${MODULE_NAME} (${config.profile}) for ${targets.join(", ")}`);
  warnAboutGlibc(config, host, targets);

  const stagingDir = intermediatePath(config, TARGET_KEY);
  for (const target of targets) {
    const module = await napi(config, host, hostArch, target);
    stageArtifact(module, stagingDir, path.basename(module));
  }
}

/// Returns the path of the built module. napi-rs also leaves it in the crate directory, which
/// is where the `file:desktop_native/napi` dependency picks it up, so running the app from a
/// checkout keeps working.
async function napi(
  config: BuildConfig,
  host: HostPlatform,
  hostArch: NodeArch,
  target: RustTarget,
): Promise<string> {
  // napi-rs spawns cargo with this process's environment, and its API takes no environment of
  // its own, so the cross-compilation variables have to be set here.
  Object.assign(process.env, buildEnv(host, hostArch, target));
  if (config.profile === "debug") {
    process.env.RUST_LOG = "debug";
  }

  const { task } = await new NapiCli().build({
    cwd: path.join(projectDir, CRATE_DIR),
    target,
    release: config.profile === "release",
    // Puts the platform triple in the module's name. index.js is checked in and generated
    // separately, so the JS binding is not rewritten here.
    platform: true,
    noJsBinding: true,
    // napi-rs reaches for cargo-xwin or cargo-zigbuild itself. configure has already checked
    // that whichever one applies is installed, which also keeps napi-rs from quietly
    // installing an unpinned copy of its own.
    crossCompile: isCrossPlatform(host, target),
  });

  const outputs = await task;
  const module = outputs.find((output) => output.kind === "node");
  if (module == null) {
    throw new BuildError(
      `napi-rs built ${target} but reported no .node artifact; it produced ` +
        `${outputs.map((output) => output.kind).join(", ") || "nothing"}.`,
    );
  }
  return module.path;
}

/// The configured glibc floor cannot be handed to napi-rs, so a cross-built module gets
/// whatever zig defaults to instead. Three routes were tried and none of them work:
///
///   - Passing `<triple>.<glibc>` as the target. napi-rs uses that string both as a directory
///     name under target/ and as the source of the module's platform suffix, so it looks for
///     the artifact in a directory cargo-zigbuild never wrote and names the module something
///     desktop_native/napi/index.js will not load.
///   - Setting CARGO_BUILD_TARGET, which cargo-zigbuild does read. napi-rs always passes an
///     explicit `--target`, and that wins over the environment.
///   - Appending a second, versioned `--target` through `cargoOptions`. Measured: the plain
///     target stays in effect.
///
/// This only affects cross builds; CI builds Linux on native runners. Left as a warning rather
/// than an error because zig's default floor is lower than the configured one -- measured at
/// GLIBC_2.30 against a configured 2.35 -- so the module is more portable than the rest of the
/// package, not less.
function warnAboutGlibc(config: BuildConfig, host: HostPlatform, targets: RustTarget[]): void {
  if (config.linux?.glibc == null || !targets.some((target) => isCrossPlatform(host, target))) {
    return;
  }
  console.warn(
    `warning: cross-compilation detected: the ${MODULE_NAME} glibc version may not match the ` +
      "configured glibc version.",
  );
}
