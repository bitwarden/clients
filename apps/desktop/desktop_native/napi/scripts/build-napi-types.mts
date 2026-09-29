import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { type BuildTask, type BuildConfig, BuildError } from "../../../scripts/build-config.mts";
import { Logger, runCommand } from "../../../scripts/build-support.mts";
import { CARGO_WORKSPACE_DIR, napiDerivePackages } from "../../../scripts/build-support-rust.mts";

// TODO: @napi-rs/cli resolves here only because npm hoists it; see build-napi.mts.
import { generateTypeDef, readNapiConfig } from "@napi-rs/cli";

const SOURCE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../");
const CRATE_PACKAGE_NAME = "desktop_napi";

/**
 * Generates index.d.ts, the "header" that the TypeScript application compiles against, without
 * waiting for NapiBindings to finish compiling and linking the module.
 *
 * napi-derive writes type definitions as a side effect of macro expansion, which happens in the
 * compiler frontend, so `cargo check` is enough to produce them. The result does not depend on
 * the Rust target or profile (no `#[napi]` item is cfg-gated), so it is generated once for the
 * host, and in debug, regardless of what the build is for.
 */
const NapiTypesBuildTask: BuildTask = {
  targetName: "NapiTypes",
  sourceDir: SOURCE_DIR,
  dependencies: [],

  async validate(config: BuildConfig): Promise<void> {
    if (!config.toolchains.cargo.bin) {
      throw new AggregateError(
        [new BuildError("Path to Cargo binary not set")],
        `Build configuration of ${this.targetName} failed validation`,
      );
    }
  },

  async configure(config: BuildConfig): Promise<void> {},

  async build(config: BuildConfig, outputDir: string, privateDir: string): Promise<void> {
    const cargoBin = config.toolchains.cargo.bin;

    // A target directory of its own, so that this check does not wait on Cargo's lock while
    // NapiBindings (or any other Rust task) builds in the shared one. It lives under the
    // workspace target directory rather than privateDir so that build directories share it.
    // Cargo has to create the directory itself: it only writes the CACHEDIR.TAG that
    // `cargo clean` insists on when it does.
    const stateDir = path.join(config.derived.cargoTargetDir, "napi-types");
    const checkTargetDir = path.join(stateDir, "cargo");
    // Paired with checkTargetDir: napi-derive only writes a crate's file when it expands that
    // crate's macros, which Cargo skips for crates that are fresh in checkTargetDir.
    const typeDefDir = path.join(stateDir, "type-def");

    // If the files are gone but the check artifacts are not, the fresh crates would never
    // write them again. napi-rs forces a rebuild with NAPI_FORCE_BUILD_<CRATE>, but that is only
    // honoured by crates with a napi_build script, which autofill_provider does not have, so
    // clean the crates that use napi-derive instead.
    // The directory is created only after the clean succeeds, so a failed clean is retried.
    if (!existsSync(typeDefDir) && existsSync(checkTargetDir)) {
      const packages = await napiDerivePackages(cargoBin);
      await runCommand(
        cargoBin,
        ["clean", "--target-dir", checkTargetDir, ...packages.flatMap((p) => ["--package", p])],
        { cwd: CARGO_WORKSPACE_DIR, logLevel: "debug" },
      );
    }
    mkdirSync(typeDefDir, { recursive: true });

    await runCommand(
      cargoBin,
      ["check", "--package", CRATE_PACKAGE_NAME, "--target-dir", checkTargetDir],
      {
        cwd: CARGO_WORKSPACE_DIR,
        env: { NAPI_TYPE_DEF_TMP_FOLDER: typeDefDir },
        logLevel: "debug",
        timing: true,
      },
    );

    const napiConfig = await readNapiConfig(path.join(SOURCE_DIR, "package.json"));
    const { dts } = await generateTypeDef({
      typeDefDir,
      cwd: SOURCE_DIR,
      configDtsHeader: napiConfig.dtsHeader,
      configDtsHeaderFile: napiConfig.dtsHeaderFile,
      constEnum: napiConfig.constEnum,
      runtimeStringEnum: napiConfig.runtimeStringEnum,
    });
    if (dts.length === 0) {
      throw new BuildError(`napi-derive produced no type definitions in ${typeDefDir}`);
    }

    // Only write when the interface changed, so that the mtime tells the TypeScript
    // application's dep file whether it has to recompile.
    const indexDtsPath = path.join(SOURCE_DIR, "index.d.ts");
    if (existsSync(indexDtsPath) && readFileSync(indexDtsPath, "utf-8") === dts) {
      Logger.debug(`${indexDtsPath} is up to date`);
      return;
    }
    writeFileSync(indexDtsPath, dts, "utf-8");
  },
};

export default NapiTypesBuildTask;
