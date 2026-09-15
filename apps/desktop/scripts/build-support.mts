/// Shared plumbing for the per-target build scripts.
///
/// Each `build-*.mts` reads the configuration written by `configure.mts`, builds one target,
/// and stages the result at the path the configuration named for it. This module holds the
/// parts none of them should be spelling out themselves.

import { execFileSync } from "child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import path from "path";
import { parseArgs } from "util";

import {
  BUILD_CONFIG_FILENAME,
  CONFIG_VERSION,
  BuildError,
  type BuildConfig,
} from "./build-config.mts";

export const projectDir = path.resolve(import.meta.dirname, "..");

export interface BuildArgs {
  buildDir?: string;
  help: boolean;
}

export function parseBuildArgs(argv: string[]): BuildArgs {
  try {
    const { values } = parseArgs({
      args: argv,
      options: { "build-dir": { type: "string" }, help: { type: "boolean" } },
      allowPositionals: false,
    });
    return { buildDir: values["build-dir"], help: values.help === true };
  } catch (error) {
    throw new BuildError(error instanceof Error ? error.message : String(error));
  }
}

export function loadBuildConfig(buildDir: string | undefined): BuildConfig {
  if (buildDir == null || buildDir.trim() === "") {
    throw new BuildError("--build-dir is required.");
  }

  const configPath = path.resolve(projectDir, buildDir, BUILD_CONFIG_FILENAME);
  if (!existsSync(configPath)) {
    throw new BuildError(
      `No build configuration at ${configPath}.\n` +
        `       Run: node scripts/configure.mts --build-dir ${buildDir} ...`,
    );
  }

  let config: BuildConfig;
  try {
    config = JSON.parse(readFileSync(configPath, "utf8")) as BuildConfig;
  } catch (error) {
    throw new BuildError(
      `${configPath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (config.configVersion !== CONFIG_VERSION) {
    throw new BuildError(
      `${configPath} was written by a different version of configure ` +
        `(found ${config.configVersion}, expected ${CONFIG_VERSION}). Reconfigure the build ` +
        "directory.",
    );
  }

  return config;
}

/// Absolute path of a target's staging directory or file, as named by the configuration.
export function intermediatePath(config: BuildConfig, target: string): string {
  const intermediate = config.intermediates[target];
  if (intermediate == null) {
    throw new BuildError(`The configuration does not name an intermediate for '${target}'.`);
  }
  return path.resolve(projectDir, intermediate);
}

export interface RunOptions {
  /// Working directory, relative to apps/desktop.
  cwd?: string;
  env?: Record<string, string>;
}

export function runCommand(bin: string, args: string[], options: RunOptions = {}): void {
  const cwd = path.resolve(projectDir, options.cwd ?? ".");
  // eslint-disable-next-line no-console
  console.log(`> ${[bin, ...args].join(" ")}${options.cwd == null ? "" : `  (in ${options.cwd})`}`);
  try {
    execFileSync(bin, args, {
      cwd,
      stdio: "inherit",
      env: { ...process.env, ...options.env },
    });
  } catch (error) {
    // The command inherited stdio, so it has already said what went wrong. Report the failure
    // rather than letting execFileSync's error object become a stack trace on top of it.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new BuildError(`${bin} was not found on PATH.`);
    }
    const status = (error as { status?: number }).status;
    throw new BuildError(
      `${bin} ${args.join(" ")} failed${status == null ? "" : ` with exit code ${status}`}.`,
    );
  }
}

/// Copies a built artifact to where the configuration says it belongs.
export function stageArtifact(from: string, intoDir: string, as: string): void {
  if (!existsSync(from)) {
    throw new BuildError(`Expected a build output at ${from}, but it is not there.`);
  }
  mkdirSync(intoDir, { recursive: true });
  const to = path.join(intoDir, as);
  copyFileSync(from, to);
  // eslint-disable-next-line no-console
  console.log(`Staged ${path.relative(projectDir, to)}`);
}

/// Runs a build script's entry point, turning the errors it reports into a clean exit rather
/// than a stack trace.
export function runScript(main: () => void): void {
  try {
    main();
  } catch (error) {
    if (error instanceof BuildError) {
      // eslint-disable-next-line no-console
      console.error(`error: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}
