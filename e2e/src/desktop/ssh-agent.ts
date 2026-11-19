import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, Locator, Page } from "@playwright/test";

import { SshKey } from "../ssh/keys";

import { test as desktopTest } from "./fixtures";

// The approval dialog (apps/desktop/src/autofill/components/approve-ssh-request.html).
const APPROVAL_DIALOG = "ssh-approval-dialog";
const FORWARDING_WARNING = "ssh-approval-forwarding-warning";
const AUTHORIZE_BUTTON = "ssh-approval-authorize-button";
const DENY_BUTTON = "ssh-approval-deny-button";

// The activity log (apps/desktop/src/autofill/components/ssh-agent-activity.component.html).
const ACTIVITY_DIALOG = "ssh-agent-activity-dialog";
const ACTIVITY_ROW = "ssh-agent-activity-row";
const ACTIVITY_APP = "ssh-agent-activity-app";
const ACTIVITY_COMMAND = "ssh-agent-activity-command";
const ACTIVITY_REQUEST = "ssh-agent-activity-request";
const ACTIVITY_RESULT = "ssh-agent-activity-result";

// Unix socket paths are capped at 104 bytes on macOS; the repo's .debug dir can be deeper.
const SOCKET_DIR_PREFIX = join(tmpdir(), "bw-ssh-");
const SOCKET_NAME = "agent.sock";

/** Where the sign request the approval dialog shows comes from. */
export const SshRequestOrigin = Object.freeze({
  /** A client on this machine, talking to the agent's socket. */
  Local: "local",
  /** A client on a server the user logged in to with agent forwarding. */
  Forwarded: "forwarded",
} as const);
export type SshRequestOrigin = (typeof SshRequestOrigin)[keyof typeof SshRequestOrigin];

/**
 * Answers the app's SSH approval dialog, which the agent raises for every sign request while
 * "Ask for authorization" is "Always", the default.
 */
export class SshApproval {
  constructor(private window: Page) {}

  /** Waits for a request to use `key`, from `origin`, and authorizes it. */
  async authorize(key: SshKey, origin: SshRequestOrigin) {
    await this.answer(key, origin, AUTHORIZE_BUTTON);
  }

  /** Waits for a request to use `key`, from `origin`, and denies it. */
  async deny(key: SshKey, origin: SshRequestOrigin) {
    await this.answer(key, origin, DENY_BUTTON);
  }

  private async answer(key: SshKey, origin: SshRequestOrigin, button: string) {
    const dialog = this.window.getByTestId(APPROVAL_DIALOG);

    // Names the vault item, so a request for another key never passes.
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(key.name);

    const warning = dialog.getByTestId(FORWARDING_WARNING);
    if (origin === SshRequestOrigin.Forwarded) {
      await expect(warning).toBeVisible();
    } else {
      await expect(warning).toBeHidden();
    }

    await dialog.getByTestId(button).click();
    await expect(dialog).toBeHidden();
  }
}

/** One row of the SSH agent's activity log, as the user reads it. */
export type SshActivityEntry = {
  app: string;
  command: string;
  request: string;
  result: string;
};

/** Reads the SSH agent's activity log dialog, newest entry first. */
export class SshActivityLog {
  constructor(private window: Page) {}

  async entries(): Promise<SshActivityEntry[]> {
    const dialog = this.window.getByTestId(ACTIVITY_DIALOG);
    await expect(dialog).toBeVisible();

    const rows = await dialog.getByTestId(ACTIVITY_ROW).all();
    return Promise.all(
      rows.map(async (row) => ({
        app: await text(row.getByTestId(ACTIVITY_APP)),
        command: await text(row.getByTestId(ACTIVITY_COMMAND)),
        request: await text(row.getByTestId(ACTIVITY_REQUEST)),
        result: await text(row.getByTestId(ACTIVITY_RESULT)),
      })),
    );
  }
}

// Collapses the whitespace the template's line breaks add.
async function text(locator: Locator): Promise<string> {
  return (await locator.innerText()).replace(/\s+/g, " ").trim();
}

/**
 * Desktop `test` with the SSH agent's socket at `agentSocket` instead of the
 * user's `~/.bitwarden-ssh-agent.sock`.
 */
export const test = desktopTest.extend<{
  agentSocket: string;
  approval: SshApproval;
}>({
  agentSocket: async ({}, use) => {
    const dir = mkdtempSync(SOCKET_DIR_PREFIX);
    await use(join(dir, SOCKET_NAME));
    rmSync(dir, { recursive: true, force: true });
  },
  extraEnv: async ({ extraEnv, agentSocket }, use) => {
    await use({ ...extraEnv, BITWARDEN_SSH_AUTH_SOCK: agentSocket });
  },
  approval: async ({ window }, use) => {
    await use(new SshApproval(window));
  },
});

export { expect } from "@playwright/test";
