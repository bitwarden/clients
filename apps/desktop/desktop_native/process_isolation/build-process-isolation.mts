import { copyFileSync, readFileSync, utimesSync, statSync, writeFileSync, appendFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from 'url';

import { rustTargetsFor } from "../../scripts/build-support-rust.mts";
import RustBuildTask, { rustBuildArtifacts } from "../build-rust.mts";
import { BuildError, type BuildConfig, type BuildTask } from "../../scripts/build-config.mts";
import { addDepFileEntry, Logger, processDepFile, runCommand, withExt, withStemSuffix } from "../../scripts/build-support.mts";

const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));
const CRATE_PACKAGE_NAME = "process_isolation";

const ProcessIsolationBuildTask: BuildTask = {
  targetName: "ProcessIsolationBuildTask",
  sourceDir: SOURCE_DIR,
  dependencies: [RustBuildTask],

  async validate(config: BuildConfig): Promise<void> {
    const validationErrors: BuildError[] = [];

    if (!config.platform) {
      validationErrors.push(new BuildError("Platform not set"));
    }

    if (!config.profile) {
      validationErrors.push(new BuildError("Profile not set"));
    }

    if (!config.toolchains.cargo.bin) {
      validationErrors.push(new BuildError("Path to Cargo binary not set"));
    }

    if (validationErrors.length > 0) {
      throw new AggregateError(validationErrors, `Build configuration of ${this.targetName} failed validation`);
    }
  },

  async configure(config: BuildConfig, outputDir: string, privateDir: string): Promise<void> {},

  async build(config: BuildConfig, outputDir: string, privateDir: string): Promise<void> {
    const taskDepFilePath = path.join(privateDir, `${this.targetName}.d`);
    const isStale = !existsSync(taskDepFilePath) || processDepFile(taskDepFilePath).isStale;
    if (!isStale) {
      Logger.debug(`${this.targetName} is up to date, skipping build`);
      return;
    }
    const { platform } = config;
    const rustTargets = rustTargetsFor(config.platform, config.architecture);
    const artifacts = [];
    const extension  = {
        "linux": "so",
        "macos": "dylib",
        "windows": "dll",
    }[platform];
    // Cargo names a cdylib lib<name> everywhere but Windows.
    const artifactBasename = `${platform == "windows" ? "" : "lib"}${CRATE_PACKAGE_NAME}.${extension}`;
    for (const target of rustTargets) {
      const cargoResult = rustBuildArtifacts(config, CRATE_PACKAGE_NAME, target);

      Logger.debug({ filenames: cargoResult.filenames, depFiles: cargoResult.depFiles });
      const artifactPath = cargoResult.filenames.find(l => path.basename(l) == artifactBasename)!;
      // Copy the executable, preserving the modification times.
      const stat = statSync(artifactPath);
      const destPath = path.resolve(privateDir, withStemSuffix(path.basename(artifactPath), `-${target}`));
      copyFileSync(artifactPath, destPath);
      utimesSync(destPath, stat.atime, stat.mtime);
      artifacts.push(destPath);

      // Copy the related dependency file.
      const cargoDepFilePath = cargoResult.depFiles!.find(d => path.basename(d) == withExt(CRATE_PACKAGE_NAME, ".d"))!;
      const cargoDepFile = readFileSync(cargoDepFilePath, { encoding: "utf-8" });
      // Cargo's artifact is a dependency too: RustBuild can relink it without any source
      // changing, e.g. when the features unified across its packages change.
      const newDepFile = cargoDepFile.replace(`${artifactPath}:`, `${destPath}: ${artifactPath}`)
      const newDepFilePath = path.resolve(privateDir, withStemSuffix(withExt(path.basename(artifactPath), ".d"), `-${target}`));
      writeFileSync(newDepFilePath, newDepFile);
    }
    let artifact: string;
    const artifactOutputPath = path.resolve(outputDir, artifactBasename)
    // Combine artifacts into a universal artifact, if necessary.
    if (platform === "macos" && artifacts.length > 1) {
      const privArtifactPath = path.join(privateDir, artifactBasename);
      Logger.log(`Creating universal artifact\n  from: ${artifacts}\n  to:   ${privArtifactPath}`)
      await runCommand("lipo", ["-create", ...artifacts, "-output", privArtifactPath], { timing: true });
      artifact = privArtifactPath;
    } else {
      // Other platforms just produce a single artifact;
      artifact = artifacts[0];
    }
    copyFileSync(artifact, artifactOutputPath);

    // Create a depfile for the output task, including the transitive dependencies from Cargo.
    writeFileSync(taskDepFilePath, "", { flag: "w"});
    addDepFileEntry(taskDepFilePath, artifactOutputPath, artifacts);
    for (const artifact of artifacts) {
      const privDepFile = `${artifact}.d`
      const contents = readFileSync(privDepFile);
      appendFileSync(taskDepFilePath, contents);
    }
  },
}

export default ProcessIsolationBuildTask;

