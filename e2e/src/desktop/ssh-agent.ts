import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, mergeTests, Page } from "@playwright/test";

import { LoginPage } from "../login";
import { test as seederTest } from "../seeder/fixtures";
import { Play } from "../seeder/play";
import { seededAccount, SingleUserScene } from "../seeder/scenes/single-user.scene";
import { UserSshKeyCipherScene } from "../seeder/scenes/user-ssh-key-cipher.scene";
import { SshKey } from "../ssh/keys";

import { test as desktopTest } from "./fixtures";

const VAULT_URL = /#\/vault/;

// The approval dialog (apps/desktop/src/autofill/components/approve-ssh-request.html).
const APPROVAL_DIALOG = "ssh-approval-dialog";
const FORWARDING_WARNING = "ssh-approval-forwarding-warning";
const AUTHORIZE_BUTTON = "ssh-approval-authorize-button";
const DENY_BUTTON = "ssh-approval-deny-button";

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

/**
 * Seeds a user whose vault holds `keys` as SSH key items, and logs the desktop app in as them.
 *
 *   SeederApi ──SingleUserScene──────────▶ user
 *             ──UserSshKeyCipherScene × N─▶ SSH key items, encrypted with the user key
 */
export async function logInWithSshKeys(play: Play, window: Page, keys: SshKey[]) {
  const user = await play.scene(
    new SingleUserScene({ email: "ssh-agent@example.com", password: randomUUID() }),
  );

  for (const key of keys) {
    await play.scene(
      new UserSshKeyCipherScene({
        userId: user.result.userId,
        userKeyB64: user.result.decryptedKeyB64,
        name: key.name,
        privateKey: key.privateKey,
        publicKey: key.publicKey,
        fingerprint: key.fingerprint,
      }),
    );
  }

  const login = new LoginPage(window);
  await login.logIn(seededAccount(user));
  await login.waitForVault(VAULT_URL);
}

/**
 * Desktop `test` with seeding, and the SSH agent's socket at `agentSocket` instead of the
 * user's `~/.bitwarden-ssh-agent.sock`.
 */
export const test = mergeTests(desktopTest, seederTest).extend<{
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
