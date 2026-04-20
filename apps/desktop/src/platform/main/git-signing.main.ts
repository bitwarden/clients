import { ipcMain } from "electron";

import { script_runner } from "@bitwarden/desktop-napi";
import { LogService } from "@bitwarden/logging";

/**
 * Payload sent from the renderer. Only `args` is caller-controlled — the
 * `program` and the first-arg allow-list are enforced here in the main process.
 */
export interface GitSigningCommandPayload {
  args: string[];
}

export interface GitSigningStep {
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface GitSigningApplyResult {
  success: boolean;
  steps: GitSigningStep[];
}

export const GIT_SIGNING_IPC_CHANNEL = "gitSigning.apply";

/**
 * Main-process bridge that applies a sequence of `git config` commands via
 * the native script runner.
 *
 * SECURITY: This is the authoritative allow-list for the generic script
 * runner. The renderer cannot run arbitrary binaries — this service:
 *   - hard-codes `program = "git"`
 *   - rejects any call where `args[0] !== "config"`
 *   - runs as the current OS user (no elevation, no env override)
 *   - applies a per-command timeout
 */
export class GitSigningMainService {
  private static readonly TIMEOUT_SECS = 15;

  constructor(private readonly logService: LogService) {
    ipcMain.handle(
      GIT_SIGNING_IPC_CHANNEL,
      (_event, payload: { commands: GitSigningCommandPayload[] }) => this.apply(payload.commands),
    );
  }

  private async apply(commands: GitSigningCommandPayload[]): Promise<GitSigningApplyResult> {
    const steps: GitSigningStep[] = [];

    for (const command of commands) {
      if (command.args[0] !== "config") {
        throw new Error("gitSigning.apply only permits `git config` invocations");
      }

      const result = await script_runner.run({
        program: "git",
        args: command.args,
        timeoutSecs: GitSigningMainService.TIMEOUT_SECS,
      });

      steps.push({
        args: command.args,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      });

      if (result.exitCode !== 0) {
        this.logService.warning(
          `git config failed (exit ${result.exitCode}): ${truncate(result.stderr)}`,
        );
        return { success: false, steps };
      }
    }

    return { success: true, steps };
  }
}

function truncate(s: string, max = 500): string {
  return s.length > max ? `${s.slice(0, max)}\u2026` : s;
}
