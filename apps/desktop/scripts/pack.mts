/* eslint-disable no-console */

/// Package the app.
///
/// Takes the app source and the staged native binaries that the build scripts produced, and
/// hands electron-builder a configuration assembled from the build configuration: where things
/// are, which optional binaries to include, which installers to produce, how to sign.
///
/// The resolved configuration is written to the build directory before the build runs, so what
/// electron-builder was given is inspectable afterwards rather than being reconstructed from
/// the command line that produced it.
///
/// Usage:
///   node scripts/pack.mts --build-dir build-mac

import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import { Arch, Platform, build as electronBuilder } from "electron-builder";

import { type Architecture, type BuildConfig, BuildError } from "./build-config.mts";
import { loadBuildConfig, parseBuildArgs, projectDir, runScript } from "./build-support.mts";
import {
  applyBuildConfig,
  electronBuilderTargets,
  unsupportedChannels,
} from "./electron-builder-config.mts";

/// Everything that does not vary per build. Read rather than reproduced, so the language
/// lists, snap plugs and installer settings stay data.
const BASE_CONFIG = "electron-builder.json";
const RESOLVED_CONFIG = "electron-builder.generated.json";

const PLATFORMS = {
  macos: Platform.MAC,
  windows: Platform.WINDOWS,
  linux: Platform.LINUX,
};

const ARCHITECTURES: Record<Architecture, Arch> = {
  ia32: Arch.ia32,
  x64: Arch.x64,
  arm64: Arch.arm64,
  universal: Arch.universal,
};

runScript(async () => {
  const args = parseBuildArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/pack.mts --build-dir <dir>");
    return;
  }
  await pack(loadBuildConfig(args.buildDir));
});

async function pack(config: BuildConfig): Promise<void> {
  const unsupported = unsupportedChannels(config);
  if (unsupported.length > 0) {
    throw new BuildError(
      `No packaging step produces ${unsupported.join(", ")} yet. They are made from what ` +
        "electron-builder outputs, by steps that have not been written.",
    );
  }

  const appSource = path.resolve(projectDir, config.directories.appSource);
  if (!existsSync(path.join(appSource, "package.json"))) {
    throw new BuildError(
      `No app source at ${config.directories.appSource}.\n` +
        `       Run: node scripts/build-app.mts --build-dir ${config.buildDir}`,
    );
  }

  warnAboutUnsignedMac(config);

  const resolved = applyBuildConfig(readBaseConfig(), config);
  const resolvedPath = path.resolve(projectDir, config.buildDir, RESOLVED_CONFIG);
  writeFileSync(resolvedPath, `${JSON.stringify(resolved, null, 2)}\n`);
  console.log(`Wrote ${path.relative(projectDir, resolvedPath)}`);

  const targets = electronBuilderTargets(config);
  console.log(`Packaging ${targets.join(", ")} for ${config.architectures.join(", ")}`);

  await electronBuilder({
    projectDir,
    config: resolved,
    targets: PLATFORMS[config.derived.platform].createTarget(
      targets,
      ...config.architectures.map((architecture) => ARCHITECTURES[architecture]),
    ),
    // Artifacts are collected from the output directory by whoever asked for the build.
    // Leaving this unset would let electron-builder publish on a tagged CI run.
    publish: "never",
  });
}

/// after-pack.js signs the proxy binary with the hardened runtime whatever the configuration
/// says, picking an identity out of the keychain. Turning electron-builder's signing off makes
/// it strip the signatures the hook then tries to replace, and the pack fails partway through.
/// The hooks read the environment rather than the build configuration; until they read it, an
/// unsigned macOS package is not something this can produce.
function warnAboutUnsignedMac(config: BuildConfig): void {
  if (config.derived.platform === "macos" && config.macos?.signingCertificate === "none") {
    console.warn(
      "warning: --macos-signing-certificate none is not yet honored end to end; the packaging " +
        "hooks sign the proxy binary regardless and this build will fail while doing so.",
    );
  }
}

function readBaseConfig(): Record<string, unknown> {
  const basePath = path.join(projectDir, BASE_CONFIG);
  try {
    return JSON.parse(readFileSync(basePath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    throw new BuildError(
      `Could not read ${BASE_CONFIG}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
