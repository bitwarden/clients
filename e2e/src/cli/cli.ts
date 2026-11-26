import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { Account, account } from "../credentials";
import { FeatureFlag } from "../feature-flags";
import { CLI_ENTRY, CLI_PROFILE_DIR, DESKTOP_PROXY, E2E_STATE_DIR } from "../paths";
import { ProcessResult, run } from "../process";
import { IS_DEV_SERVER } from "../server";

/**
 * Overrides the CLI's feature flags the way the automation driver overrides a client's
 * (libs/automation-driver/src/capabilities/feature-flags.ts): the same global state key, written
 * straight into the profile, because the CLI has no page to drive.
 *
 * Global state is stored as `global_<state definition>_<key>`; the definition is `CONFIG_DISK`.
 */
const FEATURE_FLAG_OVERRIDES_KEY = "global_config_featureFlagOverrides";
const DATA_FILE = "data.json";

/** The local dev server's certificate is self-signed, and the CLI is a plain Node process. */
const TLS_ENV = IS_DEV_SERVER ? { NODE_TLS_REJECT_UNAUTHORIZED: "0" } : {};

export type CliStatus = { status: "unauthenticated" | "locked" | "unlocked" };

/**
 * The `bw` CLI, in a profile of its own, talking to this suite's desktop app:
 *
 *   bw ──spawns──▶ desktop_proxy ──IPC socket (.debug/e2e)──▶ desktop main
 *
 * Nothing here points at an installed Bitwarden: the proxy path and the socket directory are
 * both given explicitly.
 */
export class Cli {
  constructor(private flags: FeatureFlag[] = []) {}

  /** Empties the profile and writes the flag overrides into it, before the first command. */
  reset() {
    rmSync(CLI_PROFILE_DIR, { recursive: true, force: true });
    mkdirSync(CLI_PROFILE_DIR, { recursive: true });

    const overrides = Object.fromEntries(this.flags.map((flag) => [flag, true]));
    writeFileSync(
      resolve(CLI_PROFILE_DIR, DATA_FILE),
      JSON.stringify({ [FEATURE_FLAG_OVERRIDES_KEY]: overrides }),
    );
  }

  /**
   * Runs `bw`. Stdin is closed, so a command that falls back to a prompt ends instead of
   * hanging — which is what a test asserting the fallback wants to see.
   */
  run(args: string[], env: Record<string, string> = {}): Promise<ProcessResult> {
    return run(process.execPath, [CLI_ENTRY, ...args], {
      input: "",
      env: {
        BITWARDENCLI_APPDATA_DIR: CLI_PROFILE_DIR,
        BITWARDEN_DESKTOP_PROXY_PATH: DESKTOP_PROXY,
        BITWARDEN_IPC_SOCKET_DIR: E2E_STATE_DIR,
        ...TLS_ENV,
        ...env,
      },
    });
  }

  async logIn(target: Account = account()): Promise<void> {
    await this.runOrThrow(["config", "server", target.server]);
    await this.runOrThrow(["login", target.email, target.password, "--raw"]);
  }

  async lock(): Promise<void> {
    await this.runOrThrow(["lock"]);
  }

  /**
   * `bw unlock` with nothing to type and no biometric prompt allowed, so the only way it can
   * succeed is the desktop app handing over its session.
   */
  unlockFromDesktop(): Promise<ProcessResult> {
    return this.run(["unlock", "--raw"], { BW_NOINTERACTION: "true" });
  }

  /** `bw unlock` as a user runs it, which may raise a biometric prompt on the desktop app. */
  unlockInteractively(): Promise<ProcessResult> {
    return this.run(["unlock", "--raw"]);
  }

  unlockWithPassword(password: string): Promise<ProcessResult> {
    return this.run(["unlock", password, "--raw"], { BW_NOINTERACTION: "true" });
  }

  async status(session?: string): Promise<CliStatus> {
    const result = await this.runOrThrow([
      "status",
      ...(session == null ? [] : ["--session", session]),
    ]);
    return JSON.parse(result.stdout);
  }

  private async runOrThrow(args: string[]): Promise<ProcessResult> {
    const result = await this.run(args, { BW_NOINTERACTION: "true" });
    if (result.code !== 0) {
      throw new Error(`bw ${args[0]} exited ${result.code}:\n${result.stderr}${result.stdout}`);
    }

    return result;
  }
}
