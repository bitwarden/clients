import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  type BuildConfig,
  type BuildTask,
  BuildError,
  getBuildDirectories,
} from "../scripts/build-config.mts";
import { runCommand } from "../scripts/build-support.mts";
import {
  CARGO_WORKSPACE_DIR,
  type RustTarget,
  napiDerivePackages,
  runCargoBuildPackages,
  rustTargetsFor,
} from "../scripts/build-support-rust.mts";

const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_FILE = "artifacts.json";
const NAPI_PACKAGE_NAME = "desktop_napi";

/// The package each task that ships a Rust artifact takes from this one. Keyed by task name
/// rather than by task because those tasks depend on this one.
///
/// BitwardenMacosProvider is deliberately absent: it builds autofill_provider with the `uniffi`
/// feature, and in the same invocation Cargo would unify that with the `napi` feature
/// desktop_napi enables, which changes what both of them compile.
const PACKAGES_BY_TASK: Record<string, string> = {
  NapiBindings: NAPI_PACKAGE_NAME,
  DesktopProxyBuildTask: "desktop_proxy",
  ChromiumImporterBuildTask: "bitwarden_chromium_import_helper",
  ProcessIsolationBuildTask: "process_isolation",
};

interface RustArtifacts {
  filenames: string[];
  depFiles: string[];
}

/// Artifacts by Rust target, then by package.
type ArtifactsManifest = Partial<Record<RustTarget, Record<string, RustArtifacts>>>;

/**
 * Compiles the Rust packages of every enabled task in one Cargo invocation per Rust target, so
 * that Cargo schedules all of their crates together instead of each task waiting on the lock of
 * the shared target directory in turn. The tasks that ship the artifacts depend on this one and
 * look them up with {@link rustBuildArtifacts}.
 */
const RustBuildTask: BuildTask = {
  targetName: "RustBuild",
  sourceDir: SOURCE_DIR,
  dependencies: [],

  async validate(config: BuildConfig): Promise<void> {
    const validationErrors: BuildError[] = [];

    if (!config.profile) {
      validationErrors.push(new BuildError("Profile not set"));
    }

    if (!config.toolchains.cargo.bin) {
      validationErrors.push(new BuildError("Path to Cargo binary not set"));
    }

    if (validationErrors.length > 0) {
      throw new AggregateError(
        validationErrors,
        `Build configuration of ${this.targetName} failed validation`,
      );
    }
  },

  async configure(config: BuildConfig): Promise<void> {},

  async build(config: BuildConfig, outputDir: string): Promise<void> {
    const {
      profile,
      toolchains: {
        cargo: { bin: cargoBin },
      },
    } = config;
    const packages = config.targets
      .filter((target) => target in PACKAGES_BY_TASK)
      .map((target) => PACKAGES_BY_TASK[target]);
    if (packages.length === 0) {
      return;
    }

    const manifest: ArtifactsManifest = {};
    // One invocation per target rather than one with every --target: the NAPI type definitions
    // are written to a directory named in the environment, which is shared by the whole
    // invocation, and compiling desktop_napi for two targets at once would interleave its writes.
    for (const target of rustTargetsFor(config.platform, config.architecture)) {
      const env: Record<string, string> = {};
      if (packages.includes(NAPI_PACKAGE_NAME)) {
        env.NAPI_TYPE_DEF_TMP_FOLDER = await prepareNapiTypeDefDir(config, target);
      }
      // desktop_napi reads RUST_LOG at compile time for its default log filter.
      if (profile === "debug") {
        env.RUST_LOG = "debug";
      }

      const results = await runCargoBuildPackages(cargoBin, packages, [], target, profile, env);
      const artifacts: Record<string, RustArtifacts> = {};
      for (const [packageName, { filenames, depFiles }] of results) {
        if (!filenames || !depFiles) {
          throw new BuildError(`Cargo did not output expected files for ${packageName}`);
        }
        artifacts[packageName] = { filenames, depFiles };
      }
      manifest[target] = artifacts;
    }

    writeFileSync(path.join(outputDir, ARTIFACTS_FILE), JSON.stringify(manifest, null, 2));
  },
};

/**
 * The files Cargo produced for `packageName` on `target` in the last RustBuild, in the shape
 * `runCargoBuild` returns them.
 */
export function rustBuildArtifacts(
  config: BuildConfig,
  packageName: string,
  target: RustTarget,
): RustArtifacts {
  const { outputDir } = getBuildDirectories(config, RustBuildTask);
  const manifestPath = path.join(outputDir, ARTIFACTS_FILE);
  if (!existsSync(manifestPath)) {
    throw new BuildError(`${RustBuildTask.targetName} has not produced ${manifestPath}`);
  }
  const manifest: ArtifactsManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const artifacts = manifest[target]?.[packageName];
  if (!artifacts) {
    throw new BuildError(
      `${RustBuildTask.targetName} did not build ${packageName} for ${target}; is its task enabled?`,
    );
  }
  return artifacts;
}

/**
 * Where napi-derive writes desktop_napi's type definitions when RustBuild compiles it for
 * `target`. It sits in Cargo's output directory for the target and profile because its contents
 * are only complete while they match the crates Cargo considers fresh there.
 */
export function napiTypeDefDir(config: BuildConfig, target: RustTarget): string {
  const profileDir = config.profile === "release" ? "release" : "debug";
  return path.join(config.derived.cargoTargetDir, target, profileDir, "napi-type-def");
}

/**
 * napi-derive only writes a crate's file when it expands that crate's macros, which Cargo skips
 * for fresh crates. So if the directory is missing but the crates were already compiled, clean
 * them so that they are expanded again. napi-rs forces this with NAPI_FORCE_BUILD_<CRATE>, which
 * autofill_provider does not honour because it has no napi_build script.
 */
async function prepareNapiTypeDefDir(config: BuildConfig, target: RustTarget): Promise<string> {
  const typeDefDir = napiTypeDefDir(config, target);
  // The directory is created only after the clean succeeds, so a failed clean is retried.
  if (!existsSync(typeDefDir) && existsSync(path.dirname(typeDefDir))) {
    const cargoBin = config.toolchains.cargo.bin;
    const packages = await napiDerivePackages(cargoBin);
    await runCommand(
      cargoBin,
      [
        "clean",
        "--target",
        target,
        "--profile",
        config.profile === "release" ? "release" : "dev",
        ...packages.flatMap((p) => ["--package", p]),
      ],
      { cwd: CARGO_WORKSPACE_DIR, logLevel: "debug" },
    );
  }
  mkdirSync(typeDefDir, { recursive: true });
  return typeDefDir;
}

export default RustBuildTask;
