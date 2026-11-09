import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { expect, Page } from "@playwright/test";

import { E2E_STATE_DIR, REPO_ROOT } from "../paths";
import { ProcessResult, run, runOrThrow } from "../process";

/**
 * apps/desktop/native-messaging-test-runner: a stand-in for DuckDuckGo. Each command spawns
 * desktop_proxy, handshakes with the desktop app, then sends one encrypted command.
 *
 *   runner ──stdio──▶ desktop_proxy ──IPC socket (.debug/e2e)──▶ desktop main ──▶ renderer
 */
const RUNNER_DIR = resolve(REPO_ROOT, "apps/desktop/native-messaging-test-runner");
const COMMANDS_DIR = resolve(
  RUNNER_DIR,
  "dist/apps/desktop/native-messaging-test-runner/src/commands",
);

// The debug build, which honors BITWARDEN_IPC_SOCKET_DIR; never an installed app's proxy.
const PROXY_PATH = resolve(REPO_ROOT, "apps/desktop/desktop_native/target/debug/desktop_proxy");

// Where enabling the integration writes DuckDuckGo's host manifest (NativeMessagingMain).
const DUCKDUCKGO_CONTAINER = resolve(homedir(), "Library/Containers/com.duckduckgo.macos.browser");

/** The runner's commands, by their compiled file name. */
export const RunnerCommand = Object.freeze({
  Handshake: "bw-handshake",
  Status: "bw-status",
  RetrieveCredentials: "bw-credential-retrieval",
  GeneratePassword: "bw-generate-password",
} as const);
export type RunnerCommand = (typeof RunnerCommand)[keyof typeof RunnerCommand];

/** What the runner logs; it always exits 0, so its log is the only verdict. */
export const RunnerLog = Object.freeze({
  HandshakeSucceeded: "Handshake success response",
  HandshakeCanceled: "Handshake canceled by user",
  Status: "Status output is:",
  CredentialsReturned: "Credentials returned",
  PasswordGenerated: "Response:",
} as const);
export type RunnerLog = (typeof RunnerLog)[keyof typeof RunnerLog];

/** Why the DuckDuckGo integration cannot be tested here, if it cannot. */
export function duckDuckGoUnavailable(): string | undefined {
  if (process.platform !== "darwin") {
    return "The desktop app only offers the DuckDuckGo integration on macOS.";
  }

  if (existsSync(DUCKDUCKGO_CONTAINER)) {
    return "DuckDuckGo is installed; enabling the integration would overwrite its host manifest.";
  }

  return undefined;
}

/** Installs and compiles the runner, which is its own npm package. */
export async function buildRunner() {
  if (!existsSync(resolve(RUNNER_DIR, "node_modules"))) {
    await runOrThrow("npm", ["ci", "--no-audit", "--no-fund"], { cwd: RUNNER_DIR });
  }

  await runOrThrow("npx", ["tsc"], { cwd: RUNNER_DIR });
}

/** Runs one runner command against the e2e desktop app, e.g. `--uri https://example.com`. */
export function runCommand(command: RunnerCommand, args: string[] = []): Promise<ProcessResult> {
  return run("node", [resolve(COMMANDS_DIR, `${command}.js`), ...args], {
    // module-alias resolves the runner's aliases from its package.json, in the working directory.
    cwd: RUNNER_DIR,
    env: { PROXY_PATH, BITWARDEN_IPC_SOCKET_DIR: E2E_STATE_DIR },
  });
}

// The handshake dialog (apps/desktop/src/app/components/verify-native-messaging-dialog.component.html).
const VERIFY_DIALOG = "verify-native-messaging-dialog";
const YES_BUTTON = "verify-native-messaging-yes-button";
const NO_BUTTON = "verify-native-messaging-no-button";

/** Answers the dialog the app raises for every handshake. */
export class HandshakeApproval {
  constructor(private window: Page) {}

  async approve() {
    await this.answer(YES_BUTTON);
  }

  async deny() {
    await this.answer(NO_BUTTON);
  }

  private async answer(button: string) {
    const dialog = this.window.getByTestId(VERIFY_DIALOG);
    await expect(dialog).toBeVisible();
    await dialog.getByTestId(button).click();
    await expect(dialog).toBeHidden();
  }
}
