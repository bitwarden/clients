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
import { packHooks } from "./pack-hooks.mts";

/// TODO: electron-builder merges this file in a second time, behind our back. Passing `config`
/// as an object leaves `configPath` null, and app-builder-lib's getConfig then discovers
/// electron-builder.json in the project directory and deepAssigns ours on top of it -- which
/// concatenates arrays rather than replacing them. So the base's `mac.extraFiles`, pointing at
/// the `desktop_native/dist` that build.js writes, survives alongside the entries generated
/// here: harmless while that directory is absent (electron-builder warns and skips), but a
/// stale binary there would be packaged. Passing a path instead of an object would stop the
/// discovery, but then the hooks below could not be functions. It goes away when
/// desktop_native/build.js and the legacy pack scripts do, and electron-builder.json can be
/// generated outright rather than overlaid.
///
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
      `No app source at ${appSource}.\n` +
        `       Run: bw-task build app --build-dir ${path.resolve(projectDir, config.buildDir)}`,
    );
  }

  const resolved = applyBuildConfig(readBaseConfig(), config);
  const resolvedPath = path.resolve(projectDir, config.buildDir, RESOLVED_CONFIG);
  writeFileSync(resolvedPath, `${JSON.stringify(resolved, null, 2)}\n`);
  console.log(`Wrote ${path.relative(projectDir, resolvedPath)}`);

  const targets = electronBuilderTargets(config);
  console.log(`Packaging ${targets.join(", ")} for ${config.architectures.join(", ")}`);

  await electronBuilder({
    projectDir,
    // The hooks go on after the file is written, because they are functions and would vanish
    // from it -- what is recorded there stays the configuration, not the code that runs over it.
    config: { ...resolved, ...packHooks(config), ...appxManifestHook(config) },
    targets: PLATFORMS[config.derived.platform].createTarget(
      targets,
      ...config.architectures.map((architecture) => ARCHITECTURES[architecture]),
    ),
    // Artifacts are collected from the output directory by whoever asked for the build.
    // Leaving this unset would let electron-builder publish on a tagged CI run.
    publish: "never",
  });
}

/// The beta Appx manifest is edited after electron-builder generates it, by a hook the beta
/// fork names as `scripts/appx-manifest-created.js`.
///
/// Named here rather than in the generated configuration because electron-builder resolves a
/// hook's path with `require`, against the working directory rather than the project -- and it
/// resolves every hook up front, so a relative path breaks a macOS build started from anywhere
/// but apps/desktop. Absolute, and only where there is a manifest to edit.
function appxManifestHook(config: BuildConfig): Record<string, string> {
  if (config.derived.platform !== "windows" || config.channel !== "beta") {
    return {};
  }
  return { appxManifestCreated: path.join(projectDir, "scripts/appx-manifest-created.js") };
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
