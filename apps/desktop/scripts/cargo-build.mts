/* eslint-disable no-console */

/// Builds one cargo binary from the desktop_native workspace, for the architectures the build
/// configuration asked for, and stages the results where the configuration says they belong.
///
/// Most of the native targets are exactly this: a binary name and a target key. They each get
/// their own `build-*.mts` so a caller can build one without building the rest, and so the
/// reason each one exists has somewhere to be written down.

import path from "path";

import { type BuildConfig, BuildError, targetByKey } from "./build-config.mts";
import {
  intermediatePath,
  loadBuildConfig,
  parseBuildArgs,
  projectDir,
  runCommand,
  runScript,
  stageArtifact,
} from "./build-support.mts";
import {
  type HostPlatform,
  type NodeArch,
  type RustTarget,
  asHostPlatform,
  asNodeArch,
  binaryFileName,
  buildEnv,
  rustTargetsFor,
  usesXwin,
} from "./rust-targets.mts";

const DESKTOP_NATIVE = "desktop_native";

export interface CargoBinary {
  /// Name of the binary in the desktop_native cargo workspace.
  bin: string;
  /// Key this target has in build-config.json.
  targetKey: string;
}

/// Entry point for a `build-*.mts` that builds a single cargo binary.
export function buildCargoBinary(binary: CargoBinary): void {
  runScript(() => {
    const args = parseBuildArgs(process.argv.slice(2));
    if (args.help) {
      console.log(`Usage: node scripts/${path.basename(process.argv[1])} --build-dir <dir>`);
      return;
    }
    build(binary, loadBuildConfig(args.buildDir));
  });
}

function build(binary: CargoBinary, config: BuildConfig): void {
  const { bin, targetKey } = binary;

  // Looked up before the enabled check, so a build script naming a target that does not exist
  // fails instead of quietly reporting nothing to do.
  const definition = targetByKey(targetKey);
  if (definition == null) {
    throw new BuildError(`'${targetKey}' is not a target the build configuration knows about.`);
  }

  if (config.targets[targetKey] !== true) {
    // A driver can run every build script over a configuration and let each one decide whether
    // it has anything to do.
    console.log(`${bin} is not part of this configuration, nothing to build.`);
    return;
  }

  if (!definition.platforms.includes(config.derived.platform)) {
    throw new BuildError(
      `${bin} cannot be built for ${config.derived.platform}; it applies to ` +
        `${definition.platforms.join(", ")}. Reconfigure the build directory.`,
    );
  }

  const host = asHostPlatform(process.platform);
  const hostArch = asNodeArch(process.arch);
  if (host == null || hostArch == null) {
    throw new BuildError(`${process.platform}/${process.arch} is not a supported build host.`);
  }

  const targets = rustTargetsFor(config.derived.platform, config.architectures);
  console.log(`Building ${bin} (${config.profile}) for ${targets.join(", ")}`);

  const stagingDir = intermediatePath(config, targetKey);
  for (const target of targets) {
    cargo(bin, config, host, hostArch, target);
    stageArtifact(builtBinaryPath(bin, config, target), stagingDir, binaryFileName(bin, target));
  }
}

function cargo(
  bin: string,
  config: BuildConfig,
  host: HostPlatform,
  hostArch: NodeArch,
  target: RustTarget,
): void {
  // `cargo xwin build` rather than `cargo build` when targeting Windows from elsewhere.
  // configure has already checked that cargo-xwin is installed.
  const command = usesXwin(host, target) ? ["xwin", "build"] : ["build"];
  const profileArgs = config.profile === "release" ? ["--release"] : [];

  runCommand("cargo", [...command, "--bin", bin, `--target=${target}`, ...profileArgs], {
    cwd: DESKTOP_NATIVE,
    env: buildEnv(host, hostArch, target),
  });
}

/// Where cargo leaves the binary. `--target` is passed even for a native build, so this path
/// is the same shape for every architecture.
function builtBinaryPath(bin: string, config: BuildConfig, target: RustTarget): string {
  const extension = binaryFileName(bin, target).endsWith(".exe") ? ".exe" : "";
  return path.join(
    projectDir,
    DESKTOP_NATIVE,
    "target",
    target,
    config.profile,
    `${bin}${extension}`,
  );
}
