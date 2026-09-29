import { copyFileSync, existsSync, readFileSync, statSync, utimesSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { type BuildTask, type BuildConfig, BuildError } from "../../../scripts/build-config.mts";
import { Logger, processDepFile } from "../../../scripts/build-support.mts";
import { RUST_TARGETS, type RustTarget, rustTargetsFor } from "../../../scripts/build-support-rust.mts";
import RustBuildTask, { napiTypeDefDir, rustBuildArtifacts } from "../../build-rust.mts";

// TODO: @napi-rs/cli is declared in desktop_native/napi/package.json and reaches this import
// only because npm hoists it to the workspace root. Declaring it where it is used -- as a
// devDependency of apps/desktop -- would make the resolution real rather than incidental.
// Deliberately deferred: it changes the dependency manifest the existing build system installs
// from, and that system is not being touched yet.
import { generateTypeDef, readNapiConfig } from "@napi-rs/cli";

const SOURCE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../");
const CRATE_PACKAGE_NAME = "desktop_napi";

const NapiBuildTask: BuildTask = {
  targetName: "NapiBindings",
  sourceDir: SOURCE_DIR,
  dependencies: [RustBuildTask],

  async validate(config: BuildConfig): Promise<void> {
    const validationErrors = [];
    if (config.derived.isCrossPlatform) {
      // TODO: Support cross-platform builds
      validationErrors.push(new BuildError("Cross-platform builds are not yet supported for NAPI"));
    }

    if (validationErrors.length > 0) {
      throw new AggregateError(validationErrors, `Build configuration of ${this.targetName} failed validation`);
    }
  },

  async configure(config: BuildConfig): Promise<void> {},

  async build(config: BuildConfig, outputDir: string, privateDir: string): Promise<void> {
    const targets = rustTargetsFor(config.platform, config.architecture);
    let rebuilt = false;

    for (const target of targets) {
      const privNodePath = path.join(privateDir, `napi-${target}.node`);
      const privDepPath = path.join(privateDir, `napi-${target}.d`);
      const outputBasename = moduleBasename(target);

      const isStale = !existsSync(privDepPath) || processDepFile(privDepPath).isStale;
      if (!isStale) {
        Logger.debug(`NAPI bindings for ${target} are up to date, skipping build`);
        // Ensure the .node file is present in outputDir (it may be missing after a clean).
        const destPath = path.join(outputDir, outputBasename);
        if (!existsSync(destPath)) {
          copyFileSync(privNodePath, destPath);
        }
        continue;
      }
      rebuilt = true;

      const { filenames, depFiles } = rustBuildArtifacts(config, CRATE_PACKAGE_NAME, target);
      // Cargo names a cdylib lib<name> everywhere but Windows.
      const isWindows = RUST_TARGETS[target].platform === "windows";
      const extension = { linux: "so", macos: "dylib", windows: "dll" }[RUST_TARGETS[target].platform];
      const libraryBasename = `${isWindows ? "" : "lib"}${CRATE_PACKAGE_NAME}.${extension}`;
      const libraryPath = filenames.find((f) => path.basename(f) === libraryBasename);
      if (!libraryPath) {
        throw new BuildError(`Cargo did not output ${libraryBasename} for ${target}`);
      }

      // Copy module to privateDir with the original mtime preserved.
      // processDepFile() compares the target's mtime against its dependencies,
      // so this is what determines whether the next build is stale.
      const { atime, mtime } = statSync(libraryPath);
      copyFileSync(libraryPath, privNodePath);
      utimesSync(privNodePath, atime, mtime);

      // Rewrite cargo's dep file to reference the privateDir copy, so future staleness checks
      // remain valid regardless of cargo cache changes. Cargo's artifact is added as a
      // dependency too: RustBuild can relink it without any source changing, e.g. when the
      // features unified across its packages change.
      const depBasename = `${isWindows ? "" : "lib"}${CRATE_PACKAGE_NAME}.d`;
      const cargoDepPath = depFiles.find((d) => path.basename(d) === depBasename);
      if (cargoDepPath) {
        const depContent = readFileSync(cargoDepPath, "utf-8");
        const dependencies = depContent.slice(depContent.indexOf(": ") + 2);
        writeFileSync(privDepPath, `${privNodePath}: ${libraryPath} ${dependencies}`);
      }

      copyFileSync(privNodePath, path.join(outputDir, outputBasename));
    }

    copyIfNewer(path.join(SOURCE_DIR, "index.js"), path.join(outputDir, "index.js"));

    // Keep the checked-in index.d.ts in step with what was actually built. NapiTypes normally
    // wrote the same content already, and writing only on a difference leaves the mtime alone
    // for the TypeScript application, which may be compiling against it right now.
    if (rebuilt) {
      const napiConfig = await readNapiConfig(path.join(SOURCE_DIR, "package.json"));
      const { dts } = await generateTypeDef({
        typeDefDir: napiTypeDefDir(config, targets[0]),
        cwd: SOURCE_DIR,
        configDtsHeader: napiConfig.dtsHeader,
        configDtsHeaderFile: napiConfig.dtsHeaderFile,
        constEnum: napiConfig.constEnum,
        runtimeStringEnum: napiConfig.runtimeStringEnum,
      });
      const indexDts = path.join(SOURCE_DIR, "index.d.ts");
      if (dts.length > 0 && (!existsSync(indexDts) || readFileSync(indexDts, "utf-8") !== dts)) {
        writeFileSync(indexDts, dts, "utf-8");
      }
    }
  }

}

function copyIfNewer(src: string, dest: string) {
  if (existsSync(dest) && statSync(dest).mtimeMs >= statSync(src).mtimeMs) {
    return;
  }
  copyFileSync(src, dest);
}

/// The name index.js loads the module for `target` by, which is the one napi-rs gives it.
function moduleBasename(target: RustTarget): string {
  const { nodePlatform, nodeArch } = RUST_TARGETS[target];
  const abi = { darwin: "", win32: "-msvc", linux: "-gnu" }[nodePlatform];
  return `${CRATE_PACKAGE_NAME}.${nodePlatform}-${nodeArch}${abi}.node`;
}

export default NapiBuildTask;
