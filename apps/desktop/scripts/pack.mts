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

import { execFileSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import { Arch, Platform, build as electronBuilder } from "electron-builder";

import { crossPackageAppx } from "./appx.mts";
import { type Architecture, type BuildConfig, BuildError } from "./build-config.mts";
import { loadBuildConfig, parseBuildArgs, projectDir, runScript } from "./build-support.mts";
import {
  applyBuildConfig,
  electronBuilderTargets,
  signedAppxConfig,
  unpackedDir,
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

/// Signing settings naming a file, which electron-builder passes to `codesign` and `security`
/// as given.
const SIGNING_PATHS = [
  "entitlements",
  "entitlementsInherit",
  "entitlementsLoginHelper",
  "provisioningProfile",
];

const ARCHITECTURES: Record<Architecture, Arch> = {
  ia32: Arch.ia32,
  x64: Arch.x64,
  arm64: Arch.arm64,
  universal: Arch.universal,
};

runScript(async () => {
  const args = parseBuildArgs("bw-task pack", process.argv.slice(2));
  if (args == null) {
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
    // The hooks and the absolute paths go on after the file is written -- what is recorded there
    // stays the configuration, relative and readable, not the form it has to take to run.
    config: {
      ...withAbsoluteSigningPaths(resolved),
      ...packHooks(config),
      ...appxManifestHook(config),
    },
    targets: PLATFORMS[config.derived.platform].createTarget(
      targets,
      ...config.architectures.map((architecture) => ARCHITECTURES[architecture]),
    ),
    // Artifacts are collected from the output directory by whoever asked for the build.
    // Leaving this unset would let electron-builder publish on a tagged CI run.
    publish: "never",
  });

  if (config.distributionChannels.includes("windows-appx")) {
    // Microsoft's packer only runs on Windows. Anywhere else the same package is built with
    // makemsix, from the same unpacked app and against the same configuration.
    if (process.platform === "win32") {
      await packSignedAppx(config, readBaseConfig());
    } else {
      crossPackAppx(config, resolved);
    }
  }
}

/// Packages the Appx without electron-builder, one architecture at a time.
function crossPackAppx(config: BuildConfig, resolved: Record<string, unknown>): void {
  const output = path.resolve(projectDir, config.directories.dist);
  const appVersion = readAppVersion();

  for (const architecture of config.architectures) {
    const unpacked = path.join(output, unpackedDir(architecture));
    if (!existsSync(unpacked)) {
      throw new BuildError(`No unpacked ${architecture} app at ${unpacked} to package as an Appx.`);
    }

    crossPackageAppx({ config, resolved, architecture, unpacked, appVersion });
  }
}

/// The app's own version, which is what electron-builder names artifacts after.
function readAppVersion(): string {
  const manifest = path.join(projectDir, "package.json");
  const { version } = JSON.parse(readFileSync(manifest, "utf8")) as { version?: string };
  if (version == null) {
    throw new BuildError(`${manifest} declares no version.`);
  }
  return version;
}

/// Repackages what the first pass unpacked as an Appx naming the signing certificate.
///
/// Nothing is rebuilt: electron-builder is pointed at the app directory it just produced, so
/// the binaries keep the signatures they were given, and the cost is one Appx compression per
/// architecture rather than a second build.
async function packSignedAppx(config: BuildConfig, base: Record<string, unknown>): Promise<void> {
  const output = path.resolve(projectDir, config.directories.dist);

  for (const architecture of config.architectures) {
    const prepackaged = path.join(output, unpackedDir(architecture));
    if (!existsSync(prepackaged)) {
      throw new BuildError(
        `No unpacked ${architecture} app at ${prepackaged} to repackage as a signed Appx.`,
      );
    }

    const publisher = signingSubject(path.join(prepackaged, `${config.derived.productName}.exe`));
    console.log(`Packaging a signed ${architecture} Appx published by '${publisher}'`);

    await electronBuilder({
      projectDir,
      prepackaged,
      publish: "never",
      targets: Platform.WINDOWS.createTarget("appx", ARCHITECTURES[architecture]),
      config: {
        ...signedAppxConfig(base, config, publisher),
        // The manifest this pass generates needs the same edits the first one's did.
        ...appxManifestHook(config),
        // No hooks on this pass. The app is packed and signed already, and afterPack would flip
        // the Electron fuses a second time -- which rewrites the binary and would invalidate
        // the signature this package exists to carry. These also displace the script paths the
        // checked-in configuration names, which electron-builder would otherwise load.
        beforePack: () => {},
        afterPack: () => {},
        afterSign: () => {},
      },
    });
  }
}

/// Subject of the certificate an executable was signed with.
///
/// Read from the signed binary rather than configured, because it is not a choice: the Appx
/// manifest's publisher has to be exactly this or signing fails. Whoever holds the certificate
/// is the only one who knows the subject, and by this point they have already used it.
function signingSubject(executable: string): string {
  if (!existsSync(executable)) {
    throw new BuildError(`Expected a signed executable at ${executable}, but it is not there.`);
  }

  const quoted = executable.replace(/'/g, "''");
  const output = execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `(Get-AuthenticodeSignature -LiteralPath '${quoted}').SignerCertificate.Subject`,
    ],
    { encoding: "utf8" },
  );

  const subject = output.trim();
  // PowerShell prints nothing at all for an unsigned file: there is no certificate to ask.
  if (subject === "") {
    throw new BuildError(
      `${executable} is not signed, so there is no publisher for the Appx to name.\n` +
        "       A signed Appx needs a signed app: set ELECTRON_BUILDER_SIGN and its signing " +
        "environment for the pack that produced it.",
    );
  }
  return subject;
}

/// Rewrites those to absolute paths.
///
/// The configuration records them relative to apps/desktop, which is what makes it portable.
/// But electron-builder runs `codesign` and `security` in the working directory it was called
/// from, not the project directory, so a relative path is one they cannot open unless the
/// caller happened to be standing in apps/desktop. Everything else -- `extraFiles`, the
/// directories -- electron-builder resolves against the project itself and is left alone.
function withAbsoluteSigningPaths(resolved: Record<string, unknown>): Record<string, unknown> {
  const result = { ...resolved };

  for (const platform of ["mac", "mas"]) {
    const section = result[platform];
    if (section == null || typeof section !== "object") {
      continue;
    }

    const values = { ...(section as Record<string, unknown>) };
    for (const key of SIGNING_PATHS) {
      if (typeof values[key] === "string") {
        values[key] = path.resolve(projectDir, values[key]);
      }
    }
    result[platform] = values;
  }

  // electron-builder resolves the custom Appx extensions against `directories.app`, which is
  // inside the build directory and so is not where anything of ours lives.
  const appx = result.appx as Record<string, unknown> | undefined;
  if (typeof appx?.customExtensionsPath === "string") {
    result.appx = {
      ...appx,
      customExtensionsPath: path.resolve(projectDir, appx.customExtensionsPath),
    };
  }

  // Windows signing is delegated to a script of ours, which electron-builder loads with
  // `require` -- so, like the hooks, it is resolved against the working directory.
  const win = result.win as Record<string, unknown> | undefined;
  const signtool = win?.signtoolOptions as Record<string, unknown> | undefined;
  if (typeof signtool?.sign === "string") {
    result.win = {
      ...win,
      signtoolOptions: { ...signtool, sign: path.resolve(projectDir, signtool.sign) },
    };
  }

  return result;
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
