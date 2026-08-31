/* eslint-disable no-console */

/// Builds one artifact from the desktop_native cargo workspace, for the architectures the build
/// configuration asked for, and stages the results where the configuration says they belong.
///
/// Most of the native targets are exactly this: a cargo package and a target key. They each get
/// their own `build-*.mts` so a caller can build one without building the rest, and so the
/// reason each one exists has somewhere to be written down.

import path from "path";

import { type BuildConfig, BuildError, targetByKey, targetName } from "./build-config.mts";
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
  binaryExtension,
  binaryFileName,
  buildEnv,
  builtLibraryName,
  cargoBuildCommand,
  cargoTargetArg,
  libraryFileName,
  rustTargetsFor,
} from "./rust-targets.mts";

const DESKTOP_NATIVE = "desktop_native";

export interface CargoArtifact {
  /// Package in the desktop_native cargo workspace. Every binary here is named after its own
  /// package, so this is the binary name too.
  cargoPackage: string;
  /// Key this target has in build-config.json.
  targetKey: string;
  /// An executable, or the package's cdylib.
  kind: "binary" | "library";
}

/// Entry point for a `build-*.mts` that builds a single cargo artifact.
export function buildCargoArtifact(artifact: CargoArtifact): void {
  runScript(() => {
    const step = targetByKey(artifact.targetKey);
    const args = parseBuildArgs(
      `bw-task build ${step == null ? artifact.targetKey : targetName(step)}`,
      process.argv.slice(2),
    );
    if (args == null) {
      return;
    }
    build(artifact, loadBuildConfig(args.buildDir));
  });
}

function build(artifact: CargoArtifact, config: BuildConfig): void {
  const { cargoPackage, targetKey } = artifact;

  // Looked up before the enabled check, so a build script naming a target that does not exist
  // fails instead of quietly reporting nothing to do.
  const definition = targetByKey(targetKey);
  if (definition == null) {
    throw new BuildError(`'${targetKey}' is not a target the build configuration knows about.`);
  }

  if (config.targets[targetKey] !== true) {
    // A driver can run every build script over a configuration and let each one decide whether
    // it has anything to do.
    console.log(`${cargoPackage} is not part of this configuration, nothing to build.`);
    return;
  }

  if (!definition.platforms.includes(config.derived.platform)) {
    throw new BuildError(
      `${cargoPackage} cannot be built for ${config.derived.platform}; it applies to ` +
        `${definition.platforms.join(", ")}. Reconfigure the build directory.`,
    );
  }

  const host = asHostPlatform(process.platform);
  const hostArch = asNodeArch(process.arch);
  if (host == null || hostArch == null) {
    throw new BuildError(`${process.platform}/${process.arch} is not a supported build host.`);
  }

  const targets = rustTargetsFor(config.derived.platform, config.architectures);
  console.log(`Building ${cargoPackage} (${config.profile}) for ${targets.join(", ")}`);

  const stagingDir = intermediatePath(config, targetKey);
  for (const target of targets) {
    cargo(artifact, config, host, hostArch, target);
    stageArtifact(builtPath(artifact, config, target), stagingDir, stagedName(artifact, target));
  }
}

function cargo(
  artifact: CargoArtifact,
  config: BuildConfig,
  host: HostPlatform,
  hostArch: NodeArch,
  target: RustTarget,
): void {
  // cargo-xwin or cargo-zigbuild when this is a cross build; configure has already checked
  // that whichever one it needs is installed.
  const command = cargoBuildCommand(host, target);
  const selector = artifact.kind === "binary" ? "--bin" : "--package";
  const targetArg = cargoTargetArg(host, target, config.linux?.glibc);
  const profileArgs = config.profile === "release" ? ["--release"] : [];

  runCommand(
    "cargo",
    [...command, selector, artifact.cargoPackage, `--target=${targetArg}`, ...profileArgs],
    { cwd: DESKTOP_NATIVE, env: buildEnv(host, hostArch, target) },
  );
}

/// Where cargo leaves the artifact. `--target` is passed even for a native build, so this path
/// is the same shape for every architecture.
function builtPath(artifact: CargoArtifact, config: BuildConfig, target: RustTarget): string {
  const { cargoPackage, kind } = artifact;
  const name =
    kind === "binary"
      ? `${cargoPackage}${binaryExtension(target)}`
      : builtLibraryName(cargoPackage, target);
  return path.join(projectDir, DESKTOP_NATIVE, "target", target, config.profile, name);
}

function stagedName(artifact: CargoArtifact, target: RustTarget): string {
  return artifact.kind === "binary"
    ? binaryFileName(artifact.cargoPackage, target)
    : libraryFileName(artifact.cargoPackage, target);
}
