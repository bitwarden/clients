/// Shared plumbing for the per-target build scripts.
///
/// Each `build-*.mts` reads the configuration written by `configure.mts`, builds one target,
/// and stages the result at the path the configuration named for it. This module holds the
/// parts none of them should be spelling out themselves.

import { execFileSync } from "child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "fs";
import path from "path";

import { Command } from "commander";

import {
  BUILD_CONFIG_FILENAME,
  CONFIG_VERSION,
  HELP_WIDTH,
  BuildError,
  type BuildConfig,
} from "./build-config.mts";

export const projectDir = path.resolve(import.meta.dirname, "..");
export const repoRoot = path.resolve(projectDir, "../..");

/// The caller's working directory, with symlinks resolved so it can be compared against
/// `projectDir` -- which node has already realpathed on its way to loading this module.
export function callerDir(): string {
  return realpathSync(process.cwd());
}

export interface BuildArgs {
  buildDir?: string;
}

/// Parses the flags a build step takes, which are the same for every step: each one is runnable
/// on its own, so each one is handed `--build-dir` and nothing else.
///
/// Returns undefined once it has printed `--help`, which is the caller's cue to stop without
/// building anything. `command` is how the step is spelled at the front door, so the help text
/// names the command the reader typed rather than the script behind it.
export function parseBuildArgs(command: string, argv: string[]): BuildArgs | undefined {
  const parser = new Command(command)
    .helpOption(false)
    .allowExcessArguments(false)
    .configureHelp({ helpWidth: HELP_WIDTH })
    .option("--build-dir <dir>", "Build directory holding build-config.json (required)")
    .option("--help", "Show this message")
    .exitOverride()
    // Commander writes its own diagnostics before throwing, and `runScript` reports the message
    // it gets back; printing both would say it twice.
    .configureOutput({ writeOut: () => {}, writeErr: () => {} });

  try {
    parser.parse(argv, { from: "user" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BuildError(message.replace(/^error: /, ""));
  }

  const values = parser.opts<{ buildDir?: string; help?: boolean }>();
  if (values.help === true) {
    // eslint-disable-next-line no-console
    console.log(parser.helpInformation());
    return undefined;
  }
  return { buildDir: values.buildDir };
}

/// Reads the configuration out of the directory the caller named. `--build-dir` is resolved
/// against the caller's working directory, the same as it was when they configured it, so the
/// same words mean the same directory in both steps.
export function loadBuildConfig(buildDir: string | undefined): BuildConfig {
  if (buildDir == null || buildDir.trim() === "") {
    throw new BuildError("--build-dir is required.");
  }

  const resolvedBuildDir = path.resolve(callerDir(), buildDir);
  const configPath = path.join(resolvedBuildDir, BUILD_CONFIG_FILENAME);
  if (!existsSync(configPath)) {
    throw new BuildError(
      `No build configuration at ${configPath}.\n` +
        `       Run: bw-task configure --build-dir ${buildDir} ...`,
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

  // Everything else in the file -- where the app source goes, where each intermediate is
  // staged -- is relative to apps/desktop, so a build directory that has been moved or copied
  // since it was configured would send this build's output to the directory it came from.
  const describedBuildDir = path.resolve(projectDir, config.buildDir);
  if (describedBuildDir !== resolvedBuildDir) {
    throw new BuildError(
      `${configPath} describes a build directory at ${describedBuildDir}, but it was found at ` +
        `${resolvedBuildDir}. Reconfigure it where it now lives.`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(`Build directory: ${resolvedBuildDir}`);
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
  console.log(`> ${quoteCommand(bin, args)}${options.cwd == null ? "" : `  (in ${options.cwd})`}`);
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
      `${quoteCommand(bin, args)} failed${status == null ? "" : ` with exit code ${status}`}.`,
    );
  }
}

/// Renders a command so that reading it back tells you what actually ran. Build settings like
/// `CODE_SIGN_IDENTITY=Apple Development` are a single argument, and printing them bare reads
/// as two.
function quoteCommand(bin: string, args: string[]): string {
  return [bin, ...args].map((part) => (/\s/.test(part) ? `'${part}'` : part)).join(" ");
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

/// Copies a built bundle -- a directory macOS treats as one file, like an .appex -- to the
/// exact path the configuration named for it. Symlinks are preserved verbatim so a signed
/// bundle survives the copy intact.
export function stageBundle(from: string, to: string): void {
  if (!existsSync(from)) {
    throw new BuildError(`Expected a build output at ${from}, but it is not there.`);
  }
  rmSync(to, { recursive: true, force: true });
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, verbatimSymlinks: true });
  // eslint-disable-next-line no-console
  console.log(`Staged ${path.relative(projectDir, to)}`);
}

/// Runs a build script's entry point, turning the errors it reports into a clean exit rather
/// than a stack trace. Accepts an async entry point for the targets whose build tool has a
/// promise-based API.
export function runScript(main: () => void | Promise<void>): void {
  try {
    const running = main();
    if (running instanceof Promise) {
      running.catch(report);
    }
  } catch (error) {
    report(error);
  }
}

function report(error: unknown): void {
  if (!(error instanceof BuildError)) {
    throw error;
  }
  // eslint-disable-next-line no-console
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
}
