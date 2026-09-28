import { copyFileSync, existsSync, readFileSync, renameSync, statSync, utimesSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { type BuildTask, type BuildConfig, BuildError } from "../../../scripts/build-config.mts";
import { Logger, processDepFile } from "../../../scripts/build-support.mts";
import { type RustTarget, rustTargetsFor } from "../../../scripts/build-support-rust.mts";

// TODO: @napi-rs/cli is declared in desktop_native/napi/package.json and reaches this import
// only because npm hoists it to the workspace root. Declaring it where it is used -- as a
// devDependency of apps/desktop -- would make the resolution real rather than incidental.
// Deliberately deferred: it changes the dependency manifest the existing build system installs
// from, and that system is not being touched yet.
import { NapiCli } from "@napi-rs/cli";

const SOURCE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../");

const NapiBuildTask: BuildTask = {
  targetName: "NapiBindings",
  sourceDir: SOURCE_DIR,
  dependencies: [],

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

    for (const target of targets) {
      const privNodePath = path.join(privateDir, `napi-${target}.node`);
      const privDepPath = path.join(privateDir, `napi-${target}.d`);
      const privNamePath = path.join(privateDir, `napi-${target}.name`);

      const isStale = !existsSync(privDepPath) || processDepFile(privDepPath).isStale;
      if (!isStale) {
        Logger.debug(`NAPI bindings for ${target} are up to date, skipping build`);
        // Ensure the .node file is present in outputDir (it may be missing after a clean).
        const outputBasename = readFileSync(privNamePath, "utf-8");
        const destPath = path.join(outputDir, outputBasename);
        if (!existsSync(destPath)) {
          copyFileSync(privNodePath, destPath);
        }
        continue;
      }

      const modulePath = await napi(config, target, privateDir);

      // Save the platform-specific output basename so up-to-date builds know
      // which filename to restore in outputDir.
      writeFileSync(privNamePath, path.basename(modulePath), "utf-8");

      // Copy module to privateDir with the original mtime preserved.
      // processDepFile() compares the target's mtime against its dependencies,
      // so this is what determines whether the next build is stale.
      const { atime, mtime } = statSync(modulePath);
      copyFileSync(modulePath, privNodePath);
      utimesSync(privNodePath, atime, mtime);

      // Find the cargo dep file and rewrite it to reference the privateDir copy,
      // so future staleness checks remain valid regardless of cargo cache changes.
      // The cargo artifact may be named differently from the napi-rs output (e.g.
      // libdesktop_napi.dylib vs desktop_napi.darwin-x64.node), so we replace
      // the whole target token rather than doing a path substitution.
      const cargoProfile = config.profile === "release" ? "release" : "debug";
      const cargoOutDir = path.join(config.derived.cargoTargetDir, target, cargoProfile);
      const depBasename = process.platform === "win32" ? "desktop_napi.d" : "libdesktop_napi.d";
      const cargoDepPath = path.join(cargoOutDir, depBasename);
      if (existsSync(cargoDepPath)) {
        const depContent = readFileSync(cargoDepPath, "utf-8");
        // Rewrite the target in the dep file to point to the copy of the .node file in the output directory in the priv
        const depContentRewritten = privNodePath + depContent.slice(depContent.indexOf(": "));
        writeFileSync(privDepPath, depContentRewritten);
      }

      renameSync(modulePath, path.join(outputDir, path.basename(modulePath)));
    }

    copyIfNewer(path.join(SOURCE_DIR, "index.js"), path.join(outputDir, "index.js"));

    // Keep the checked-in index.d.ts in step with what was actually built. NapiTypes normally
    // wrote the same content already, and writing only on a difference leaves the mtime alone
    // for the TypeScript application, which may be compiling against it right now.
    const builtIndexDts = path.join(privateDir, "index.d.ts");
    const indexDts = path.join(SOURCE_DIR, "index.d.ts");
    if (
      existsSync(builtIndexDts) &&
      (!existsSync(indexDts) || !readFileSync(builtIndexDts).equals(readFileSync(indexDts)))
    ) {
      copyFileSync(builtIndexDts, indexDts);
    }
  }

}

function copyIfNewer(src: string, dest: string) {
  if (existsSync(dest) && statSync(dest).mtimeMs >= statSync(src).mtimeMs) {
    return;
  }
  copyFileSync(src, dest);
}

/// Returns the path of the built module. napi-rs also leaves it in the crate directory, which
/// is where the `file:desktop_native/napi` dependency picks it up, so running the app from a
/// checkout keeps working.
async function napi(
  config: BuildConfig,
  target: RustTarget,
  privateDir: string,
): Promise<string> {
  // napi-rs spawns cargo with this process's environment, and its API takes no environment of
  // its own, so the cross-compilation variables have to be set here.
  if (config.profile === "debug") {
    process.env.RUST_LOG = "debug";
  }

  const { task } = await new NapiCli().build({
    cwd: SOURCE_DIR,
    target,
    release: config.profile === "release",
    // Puts the platform triple in the module's name.
    platform: true,
    noJsBinding: true,
    // index.d.ts is NapiTypes' output, which the TypeScript application may be compiling
    // against while this runs. napi-rs rewrites it unconditionally, so it goes to privateDir and
    // build() copies it over only if it differs. The path is resolved against the crate
    // directory.
    dts: path.relative(SOURCE_DIR, path.join(privateDir, "index.d.ts")),
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

export default NapiBuildTask;
