import { spawn } from "node:child_process";

/** What a command printed, and how it exited. */
export type ProcessResult = { code: number | null; stdout: string; stderr: string };

export type RunOptions = {
  env?: Record<string, string>;
  /** Working directory; the test's own when unset. */
  cwd?: string;
  /** Written to stdin, which is then closed. */
  input?: string;
};

// Long enough for a test to answer an app dialog, short enough to fail a hung run.
const RUN_TIMEOUT_MS = 60_000;

/**
 * Runs `command` to completion. Never rejects on a non-zero exit, since tests assert on it,
 * e.g. a denied SSH sign request makes `ssh` exit 255.
 */
export function run(command: string, args: string[], options: RunOptions = {}) {
  return new Promise<ProcessResult>((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...options.env },
      cwd: options.cwd,
      timeout: RUN_TIMEOUT_MS,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));

    child.stdin.end(options.input);
  });
}

/** Runs `command`, and throws with its output unless it exits 0. */
export async function runOrThrow(command: string, args: string[], options: RunOptions = {}) {
  const result = await run(command, args, options);
  if (result.code !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited ${result.code}:\n${result.stderr}`);
  }

  return result;
}
