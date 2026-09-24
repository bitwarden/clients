#!/usr/bin/env node
import crypto from "node:crypto";
import path from "node:path";
import { CLIENTS_PROJECT_DIR } from "./build-support.mts";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

/// Build profile the native Rust and XCode targets are built with. Defaults to debug.
export const PROFILES = ["debug", "release"] as const;
export type Profile = (typeof PROFILES)[number];

export const PLATFORMS = ["macos", "windows", "linux"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const ARCHITECTURES = ["ia32", "x64", "arm64", "universal"] as const;
export type Architecture = (typeof ARCHITECTURES)[number];

/**
 * Bitwarden release channels, e.g. stable or beta.
 *
 * Note: this is separate from {@link PACKAGE_FORMATS}, which specify the
 * packaging format.
 */
export const CHANNELS = ["stable", "beta"] as const;
export type Channel = (typeof CHANNELS)[number];

/**
 * Package formats, mapped to the platform they can be produced on. `directory` is the
 * unpacked output and belongs to no single platform.
 */
export const PACKAGE_FORMATS: Record<string, Platform | null> = {
  dmg: "macos",
  "mac-zip": "macos",
  "mac-app-store": "macos",
  "windows-installer": "windows",
  "windows-portable": "windows",
  "microsoft-store": "windows",
  "windows-appx": "windows",
  deb: "linux",
  rpm: "linux",
  appimage: "linux",
  snap: "linux",
  flatpak: "linux",
  "linux-tarball": "linux",
  directory: null,
} as const;
export type PackageFormat = keyof typeof PACKAGE_FORMATS;

export type Toolchain = "rust" | "xcode";

export const AUDIENCES = ["public", "internal"] as const;
export type Audience = (typeof AUDIENCES)[number];

export interface BuildConfig {
  configVersion: number;
  buildDir: string;
  channel: Channel;
  profile: Profile;
  architecture: Architecture;
  platform: Platform;
  packageFormats: PackageFormat[];
  audience: Audience;
  toolchains: {
    cargo: {
      bin: string;
      version: string;
    };
    node: {
      bin: string;
      version: string;
    };
  };
  buildNumber?: string;
  signed: boolean;
  macos?: {
    signingCertificate?: string;
    teamId: string;
    /// Whether to submit the packaged app to Apple. Off unless asked for: notarization needs
    /// credentials and Apple's servers, and a local build wants neither.
    notarize?: boolean;
  };
  linux?: {};
  windows?: {};
  /**
   * An ordered list of `BuildTask.targetName`s to execute.
   */
  targets: string[];
  features: {
    autofillExtension: boolean;
  };
  dependencies: Record<string, { path: string }>;
  derived: {
    hostPlatform: Platform;
    isCrossPlatform: boolean;
    appId: string;
    productName: string;
    /// Root of the Cargo build output tree, i.e. `<workspace>/target`.
    cargoTargetDir: string;
    macos?: {
      ARCHS: "arm64" | "x86_64" | "arm64 x86_64";
      appProvisioningProfile: string;
      autofillExtensionAppId: string;
      /** Name of provisioning profile for Autofill Extension. Multiple may be
       * specified to build for multiple package formats. */
      autofillExtensionProvisioningProfile: string;
      ipcAppGroup: string;
      libraryIdentifier: "macos-arm64" | "macos-x86_64" | "macos-arm64_x86_64";
    };
  };
}

export function getBuildDirectories(config: BuildConfig, task: BuildTask) {
  const buildDir = config.buildDir;
  const relativePath = path.relative(CLIENTS_PROJECT_DIR, task.sourceDir);
  if (relativePath.startsWith("..")) {
    throw new BuildError(
      `Source directory for task ${task.targetName} is not a subdirectory of clients repository.\n  Source Directory: ${task.sourceDir}\n  Build Directory: ${config.buildDir}`,
    );
  }

  const outputDir = path.resolve(buildDir, relativePath, `${task.targetName}`);
  mkdirSync(outputDir, { recursive: true });
  const privateDir = path.resolve(buildDir, relativePath, `${task.targetName}.p`);
  mkdirSync(privateDir, { recursive: true });
  return {
    outputDir,
    privateDir,
  };
}

/**
 * Get the hash of the config, useful for determining if the config has changed.
 */
export function getConfigHash(config: BuildConfig): string {
  // TODO: Currently not canonicalized, so this is effectively checking modification
  // time. We should be improve this.
  const configJson = JSON.stringify(config);
  const configHash = crypto.createHash("sha256").update(configJson, "utf-8").digest("hex");
  return configHash;
}

/**
 * Check whether, useful for invalidating artifacts previously built with a
 * now stale config.
 *
 * @param config Build configuration
 * @param privateDir Private directory for the task
 * @returns An object indicating whether the cached config file is stale or not.
 */
export function checkConfigFreshness(
  config: BuildConfig,
  privateDir: string,
): { isStale: boolean } {
  const hash = getConfigHash(config);
  const configHashPath = path.join(privateDir, "config.hash");
  if (!existsSync(configHashPath)) {
    writeFileSync(configHashPath, hash);
    return { isStale: true };
  }

  const configHashFile = readFileSync(configHashPath, { encoding: "utf-8" });
  if (hash === configHashFile) {
    return { isStale: false };
  } else {
    writeFileSync(configHashPath, hash);
    return { isStale: true };
  }
}

/// Thrown for anything a caller can fix by changing their command line or their build
/// directory: unknown flags, missing values, a configuration that isn't there. Semantic
/// problems found during validation come back from `validate` as a list instead, so the caller
/// sees all of them at once rather than one per run.
export class BuildError extends Error {}

export interface BuildTask {
  targetName: string;
  sourceDir: string;
  dependencies: BuildTask[];
  validate(config: BuildConfig): Promise<void>;
  configure(config: BuildConfig, outputDir: string, privateDir: string): Promise<void>;
  build(config: BuildConfig, outputDir: string, privateDir: string): Promise<void>;
}
