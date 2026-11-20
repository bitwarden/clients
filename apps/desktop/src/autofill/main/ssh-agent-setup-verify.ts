import { execFile as nodeExecFile } from "child_process";
import { constants as fsConstants, promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

/** Fixed allowlist of ssh binaries. Nothing is resolved through PATH. */
export const SSH_BINARY_ALLOWLIST = Object.freeze({
  unix: Object.freeze(["/usr/bin/ssh", "/bin/ssh"]),
  windows: Object.freeze(["C:\\Windows\\System32\\OpenSSH\\ssh.exe"]),
});

export const SSH_VERIFY_TIMEOUT_MS = 5000;
export const SSH_VERIFY_HOST = "example.com";
export const WINDOWS_DEFAULT_AGENT_PIPE = "\\\\.\\pipe\\openssh-ssh-agent";

export interface ExecFileOptions {
  cwd: string;
  env: Record<string, string>;
  timeout: number;
  maxBuffer: number;
  windowsHide: boolean;
  shell: false;
}

/** execFile with an argv array. Never a shell. */
export type ExecFileFn = (
  file: string,
  args: readonly string[],
  options: ExecFileOptions,
) => Promise<{ stdout: string }>;

export const defaultExecFile: ExecFileFn = (file, args, options) =>
  new Promise((resolve, reject) => {
    nodeExecFile(file, [...args], { ...options, encoding: "utf8" }, (error, stdout) => {
      if (error != null) {
        reject(error);
      } else {
        resolve({ stdout });
      }
    });
  });

export async function findSshBinary(candidates: readonly string[]): Promise<string | null> {
  for (const candidate of candidates) {
    if (!path.isAbsolute(candidate)) {
      continue;
    }
    try {
      await fs.access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // Try the next allowlisted location.
    }
  }
  return null;
}

/**
 * Parses the `identityagent` line of `ssh -G` output. Returns null when ssh would fall back to
 * SSH_AUTH_SOCK (ssh -G prints nothing for an unset IdentityAgent).
 */
export function parseIdentityAgent(output: string): string | null {
  for (const line of output.split(/\r?\n/)) {
    const match = /^identityagent\s+(.+)$/i.exec(line.trim());
    if (match != null) {
      const value = match[1].trim();
      return value.length >= 2 && value.startsWith('"') && value.endsWith('"')
        ? value.slice(1, -1)
        : value;
    }
  }
  return null;
}

export interface SshClientCheckOptions {
  windows: boolean;
  home: string;
  /** Only set for dev/test home overrides: ssh reads the passwd home, not $HOME. */
  configFile: string | null;
  binaries: readonly string[];
  execFile: ExecFileFn;
}

/**
 * Runs `ssh -G example.com` with a minimal explicit environment in an app-owned temp directory
 * and returns the IdentityAgent ssh would use. `undefined` means the check could not run.
 */
export async function readSshClientIdentityAgent(
  options: SshClientCheckOptions,
): Promise<string | null | undefined> {
  const binary = await findSshBinary(options.binaries);
  if (binary == null) {
    return undefined;
  }
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "bitwarden-ssh-verify-"));
  try {
    const env: Record<string, string> = options.windows
      ? { SystemRoot: "C:\\Windows", USERPROFILE: options.home }
      : { PATH: "/usr/bin:/bin", HOME: options.home, LANG: "C" };
    const args = [
      "-G",
      ...(options.configFile != null ? ["-F", options.configFile] : []),
      SSH_VERIFY_HOST,
    ];
    const { stdout } = await options.execFile(binary, args, {
      cwd,
      env,
      timeout: SSH_VERIFY_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      shell: false,
    });
    return parseIdentityAgent(stdout);
  } catch {
    return undefined;
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
}
