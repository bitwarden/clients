import { copyFileSync, readFileSync, utimesSync, statSync, writeFileSync, renameSync, appendFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from 'url';

import plist from "plist";

import { runCargoBuild, rustTargetsFor } from "../../scripts/build-support-rust.mts";
import { BuildError, type BuildConfig, type BuildTask, getBuildDirectories } from "../../scripts/build-config.mts";
import { addDepFileEntry, Logger, processDepFile, runCommand, withExt, withStemSuffix } from "../../scripts/build-support.mts";

const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));
const CRATE_PACKAGE_NAME = "desktop_proxy";

const DesktopProxyBuildTask: BuildTask = {
  targetName: "DesktopProxyBuildTask",
  sourceDir: SOURCE_DIR,
  dependencies: [],

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

  async configure(config: BuildConfig, outputDir: string, privateDir: string): Promise<void> {
    if (config.platform === "macos") {
      writeEntitlements(config);
    }
  },

  async build(config: BuildConfig, outputDir: string, privateDir: string): Promise<void> {
    const taskDepFilePath = path.join(privateDir, `${this.targetName}.d`);
    const isStale = !existsSync(taskDepFilePath) || processDepFile(taskDepFilePath).isStale;
    if (!isStale) {
      Logger.debug(`${this.targetName} is up to date, skipping build`);
      return;
    }
    const { platform, profile, toolchains: { cargo: { bin: cargoBin } } } = config;
    const rustTargets = rustTargetsFor(config.platform, config.architecture);
    const artifacts = [];
    const artifactBasename = `${CRATE_PACKAGE_NAME}${ platform == "windows" ? ".exe" : ""}`;
    for (const target of rustTargets) {
      const cargoResult = await runCargoBuild(cargoBin, CRATE_PACKAGE_NAME, [], target, profile);

      if (!cargoResult.filenames) {
        throw new BuildError("Cargo did not output expected files");
      }

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
      const newDepFile = cargoDepFile.replace(artifactPath, destPath)
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

/// Where configure writes the entitlements each copy of the proxy is signed with on macOS. The app
/// ships the same binary twice, and whoever packages it signs each copy with its own.
export function desktopProxyEntitlementsPaths(config: BuildConfig) {
  const { privateDir } = getBuildDirectories(config, DesktopProxyBuildTask);
  return {
    /// For desktop_proxy, which the browser launches.
    desktopProxy: path.join(privateDir, "desktop_proxy.entitlements"),
    /// For desktop_proxy.inherit, which the app launches.
    desktopProxyInherit: path.join(privateDir, "desktop_proxy.inherit.entitlements"),
  };
}

function writeEntitlements(config: BuildConfig) {
  const paths = desktopProxyEntitlementsPaths(config);
  const write = (destination: string, entitlements: plist.PlistObject) =>
    writeFileSync(destination, `${plist.build(entitlements, { indent: "\t", offset: -1 })}\n`);

  if (config.derived.macos!.isMasBuild) {
    // Launched by the browser, so it has no sandbox to inherit and has to name the app group
    // itself -- that group is the only way it can reach the app.
    write(paths.desktopProxy, {
      "com.apple.security.app-sandbox": true,
      "com.apple.security.application-groups": [config.derived.macos!.ipcAppGroup],
      "com.apple.security.cs.allow-jit": true,
    });
    // Launched by the app, whose sandbox it takes on.
    write(paths.desktopProxyInherit, {
      "com.apple.security.app-sandbox": true,
      "com.apple.security.inherit": true,
      "com.apple.security.cs.allow-jit": true,
    });
  } else {
    // Outside the sandbox the proxy needs nothing of its own, and gets what any other child
    // process of the app gets.
    for (const destination of [paths.desktopProxy, paths.desktopProxyInherit]) {
      write(destination, { "com.apple.security.cs.allow-jit": true });
    }
  }
}

export default DesktopProxyBuildTask;
