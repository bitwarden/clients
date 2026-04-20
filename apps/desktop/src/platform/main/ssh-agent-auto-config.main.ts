import { promises as fs } from "fs";
import { homedir } from "os";
import { join } from "path";

import { ipcMain } from "electron";

import { sshagent } from "@bitwarden/desktop-napi";
import { LogService } from "@bitwarden/logging";

export type SshAgentAutoConfigFileStatus =
  | "missing"
  | "already-present"
  | "conflict"
  | "written"
  | "error";

export interface SshAgentAutoConfigFileResult {
  path: string;
  status: SshAgentAutoConfigFileStatus;
  message?: string;
}

export interface SshAgentAutoConfigResult {
  supported: boolean;
  socketPath?: string;
  files: SshAgentAutoConfigFileResult[];
}

export const SSH_AGENT_AUTO_CONFIG_APPLY_CHANNEL = "sshAgentAutoConfig.apply";
export const SSH_AGENT_AUTO_CONFIG_PREVIEW_CHANNEL = "sshAgentAutoConfig.preview";

const BITWARDEN_SOCK_LINE =
  /^\s*export\s+SSH_AUTH_SOCK=.*bitwarden-ssh-agent\.sock/m;
const ANY_SOCK_LINE = /^\s*export\s+SSH_AUTH_SOCK=/m;
const BITWARDEN_MARKER = "# Added by Bitwarden — use the Bitwarden SSH agent";

/**
 * Main-process bridge that appends an `export SSH_AUTH_SOCK=...` line to the
 * user's `~/.bashrc` and `~/.zshrc` so shells route SSH requests through the
 * Bitwarden SSH agent.
 *
 * Unix-only. On Windows the Bitwarden agent uses a named pipe, so shell-rc
 * configuration does not apply.
 */
export class SshAgentAutoConfigMainService {
  private static readonly TARGET_FILES = [".bashrc", ".zshrc"];

  constructor(private readonly logService: LogService) {
    ipcMain.handle(SSH_AGENT_AUTO_CONFIG_PREVIEW_CHANNEL, () => this.run({ dryRun: true }));
    ipcMain.handle(SSH_AGENT_AUTO_CONFIG_APPLY_CHANNEL, () => this.run({ dryRun: false }));
  }

  private async run({ dryRun }: { dryRun: boolean }): Promise<SshAgentAutoConfigResult> {
    if (process.platform === "win32") {
      return { supported: false, files: [] };
    }

    const socketPath = sshagent.getSocketPath();
    if (socketPath == null) {
      return { supported: false, files: [] };
    }

    const exportLine = `export SSH_AUTH_SOCK="${socketPath}"`;
    const block = `\n${BITWARDEN_MARKER}\n${exportLine}\n`;

    const home = homedir();
    const results: SshAgentAutoConfigFileResult[] = [];

    for (const name of SshAgentAutoConfigMainService.TARGET_FILES) {
      const path = join(home, name);
      results.push(await this.handleFile(path, block, dryRun));
    }

    return { supported: true, socketPath, files: results };
  }

  private async handleFile(
    path: string,
    block: string,
    dryRun: boolean,
  ): Promise<SshAgentAutoConfigFileResult> {
    let contents: string;
    try {
      contents = await fs.readFile(path, "utf8");
    } catch (e: unknown) {
      if (errnoCode(e) === "ENOENT") {
        return { path, status: "missing" };
      }
      this.logService.warning(`sshAgentAutoConfig: could not read ${path}: ${errorMessage(e)}`);
      return { path, status: "error", message: errorMessage(e) };
    }

    if (BITWARDEN_SOCK_LINE.test(contents)) {
      return { path, status: "already-present" };
    }

    if (ANY_SOCK_LINE.test(contents)) {
      return { path, status: "conflict" };
    }

    if (dryRun) {
      return { path, status: "written" };
    }

    const prefix = contents.endsWith("\n") || contents.length === 0 ? "" : "\n";
    try {
      await fs.appendFile(path, `${prefix}${block}`, "utf8");
    } catch (e: unknown) {
      this.logService.warning(`sshAgentAutoConfig: could not write ${path}: ${errorMessage(e)}`);
      return { path, status: "error", message: errorMessage(e) };
    }
    return { path, status: "written" };
  }
}

function errnoCode(e: unknown): string | undefined {
  if (typeof e === "object" && e !== null && "code" in e) {
    const code = (e as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
