import { spawn } from "child_process";
import path from "path";

import { BuildError } from "./build-config.mts";
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from "fs";

export const CLIENTS_PROJECT_DIR = path.resolve(import.meta.dirname, "../../..");
export const DESKTOP_PROJECT_DIR = path.resolve(import.meta.dirname, "..");

// Logging
export const LogLevel: Record<string, number> = {
  debug: 4,
  warn: 3,
  info: 2,
  error: 1,
};
const LOG_LEVEL =
  (LogLevel[(process.env.LOG_LEVEL as string)?.toLowerCase()] as any) ?? LogLevel.info;

export class Logger {
  static log(message?: any, ...data: any[]) {
    this.info(message, ...data);
  }

  static debug(message?: any, ...data: any[]) {
    if (LOG_LEVEL >= LogLevel.debug) console.debug(`[${getLocalTime()}]`, message, ...data);
  }

  static info(message?: any, ...data: any[]) {
    if (LOG_LEVEL >= LogLevel.info) console.info(`[${getLocalTime()}]`, message, ...data);
  }

  static warn(message?: any, ...data: any[]) {
    if (LOG_LEVEL >= LogLevel.warn) console.warn(`[${getLocalTime()}]`, message, ...data);
  }

  static error(message?: any, ...data: any[]) {
    if (LOG_LEVEL >= LogLevel.error) console.error(`[${getLocalTime()}]`, message, ...data);
  }
}

function getLocalTime(date = new Date()) {
  const pad = (num: Number, size = 2) => String(num).padStart(size, "0");

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

// Running commands
export interface RunOptions {
  /// Working directory for the command. Relative paths are resolved relative to apps/desktop.
  cwd?: string;
  env?: Record<string, string>;
  /// Whether the length of time for running the command should be tracked and printed.
  timing?: boolean;
  /// Log level of command stdout output. Command will still be quoted and stderr will still print.
  logLevel?: keyof typeof LogLevel;
}

export async function runCommand(
  bin: string,
  args: string[],
  options: RunOptions = {},
): Promise<string> {
  const callerStack = new Error().stack;
  const cwd = path.resolve(DESKTOP_PROJECT_DIR, options.cwd ?? ".");
  if (!options.logLevel || LOG_LEVEL >= LogLevel[options.logLevel]) {
    Logger.log(`> ${quoteCommand(bin, args)}${options.cwd == null ? "" : `  (in ${options.cwd})`}`);
  }

  const { promise, resolve, reject } = Promise.withResolvers<string>();

  let start: bigint;
  if (options.timing) {
    start = process.hrtime.bigint();
  }

  const captured: Uint8Array[] = [];
  const child = spawn(bin, args, {
    cwd,
    stdio: ["inherit", "pipe", "inherit"],
    env: { ...process.env, ...options.env },
  });

  // Write out to the terminal while also capturing the data so that callers can retrieve the stdout.
  child.stdout.on("data", (data) => {
    if (LOG_LEVEL >= (LogLevel[options.logLevel as keyof typeof LogLevel] ?? LogLevel.info)) {
      process.stdout.write(data);
    }
    captured.push(data);
  });

  child.on("close", (code, signal) => {
    if (code !== 0) {
      const msg = `${quoteCommand(bin, args)} exited ${code ? `with exit code ${code}` : `with signal ${signal}`}.`;
      reject(new BuildError(msg));
    }
    if (options.timing) {
      const end = process.hrtime.bigint();
      const elapsedNs = end - (start as bigint);
      const seconds = Number(elapsedNs / 1_000_000n) / 1_000;
      Logger.log(`Command completed in ${seconds}s`);
    }
    const output = Buffer.concat(captured).toString("utf-8");
    resolve(output);
  });

  child.on("error", (error) => {
    // The command should log its own errors, so just report the failure instead of re-printing it.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new BuildError(`${bin} was not found on PATH.`);
    }
    const status = (error as { status?: number }).status;
    reject(
      new BuildError(
        `${quoteCommand(bin, args)} failed${status == null ? "" : ` with exit code ${status}`}.`,
      ),
    );
  });
  try {
    return await promise;
  } catch (error) {
    if (error instanceof Error && callerStack) {
      error.stack += "\nCalled from:\n" + callerStack.split("\n").slice(1).join("\n");
    }
    throw error;
  }
}

/// Outputs a command line. Quotes are added around args with spaces to make it
/// easier to see how the command would be parsed.
function quoteCommand(bin: string, args: string[]): string {
  return [bin, ...args].map((part) => (/\s/.test(part) ? `'${part}'` : part)).join(" ");
}

// Dep file processing.

/**
 * Adds an entry to a dep file. Does not update an entry if one exists.
 *
 * @param path Path to dep file
 * @param target Target file
 * @param dependencies Dependencies required to build the target file.
 */
export function addDepFileEntry(path: string, target: string, dependencies: string[]) {
  if (!existsSync(path)) {
    writeFileSync(path, "", { flag: "wx" });
  }
  const depFile = readFileSync(path, { encoding: "utf-8" });
  const entryExists = depFile.split("\n").some((line: string) => line.startsWith(target));
  if (!entryExists) {
    const deps = `${target}: ${dependencies.join(" ")}\n`;
    appendFileSync(path, deps);
  }
}

export function processDepFile(path: string): { isStale: boolean } {
  const depFile = readFileSync(path, { encoding: "utf-8" });

  const lines = depFile
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const allDeps = new Set();
  for (const line of lines) {
    const [target, dependencyStr] = line.split(": ");
    const dependencies = dependencyStr.split(" ");
    for (const dependency of dependencies) {
      if (allDeps.has(dependency)) {
        continue;
      }

      if (!existsSync(dependency)) {
        Logger.debug(`${target}: Dependency does not exist: ${dependency}`);
        return { isStale: true };
      }

      const targetStat = statSync(target);
      const dependencyStat = statSync(dependency);
      if (targetStat.mtime < dependencyStat.mtime) {
        Logger.debug(`${target}: Dependency is out of date: ${dependency}`);
        return { isStale: true };
      }
    }
    Logger.debug(`Target ${target} is fresh, no compilation needed`);
  }
  return { isStale: false };
}

// Directory functions

export function withExt(filename: string, ext: string) {
  const existingExt = path.extname(filename);
  const dir = path.dirname(filename);
  return path.format({
    dir: dir == "." && !filename.startsWith("./") ? undefined : dir,
    name: path.basename(filename, existingExt),
    ext,
  });
}

export function withStemSuffix(filename: string, suffix: string) {
  const ext = path.extname(filename);
  const dir = path.dirname(filename);
  return path.format({
    dir: dir == "." && !filename.startsWith("./") ? undefined : dir,
    name: path.basename(filename, ext) + suffix,
    ext,
  });
}
