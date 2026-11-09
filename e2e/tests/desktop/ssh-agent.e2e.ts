import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DesktopSettings } from "../../src/desktop/settings";
import { expect, logInWithSshKeys, SshRequestOrigin, test } from "../../src/desktop/ssh-agent";
import { generateKey, SshKey, SshKeyType } from "../../src/ssh/keys";
import { SshClient } from "../../src/ssh/ssh-client";
import { SshServer } from "../../src/ssh/ssh-server";

/**
 * The desktop SSH agent serves the vault's SSH keys to OpenSSH's own tools, asking the user
 * to approve each use. Every key type the agent supports is in the vault together, and every
 * test pins one, so a test can only pass with the key it names.
 */

// ssh exits 255 when it cannot log in, e.g. because the agent refused to sign.
const SSH_LOGIN_FAILED = 255;
const SIGNED_CONTENTS = "signed by the Bitwarden SSH agent\n";

let dir: string;
let keys: SshKey[];
let server: SshServer | undefined;

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "bw-ssh-e2e-"));
  keys = await Promise.all(Object.values(SshKeyType).map((type) => generateKey(dir, type)));
});

test.afterAll(() => {
  server?.stop();
  rmSync(dir, { recursive: true, force: true });
});

let ssh: SshClient;

test.beforeEach(async ({ app, window, play, agentSocket }) => {
  // Started here, not in beforeAll: `play` skips the test first when it cannot seed, e.g. in CI.
  server ??= await SshServer.start(dir, keys);

  await logInWithSshKeys(play, window, keys);

  const settings = new DesktopSettings(app, window);
  await settings.open();
  await settings.enableSshAgent();
  await settings.close();

  // The agent starts and loads the keys asynchronously after the setting is saved.
  ssh = new SshClient(dir, agentSocket, server);
  await expect
    .poll(async () => offersAll((await ssh.listKeys()).stdout), {
      message: "The agent never offered every vault key",
    })
    .toBe(true);
});

/** Whether `ssh-add -L` output lists every key; it prints the vault item name as the comment. */
const offersAll = (listed: string) =>
  keys.every((key) => listed.includes(key.publicKey.split(" ")[1]));

const keyOf = (type: SshKeyType) => keys.find((key) => key.type === type)!;

for (const type of Object.values(SshKeyType)) {
  test.describe(type, () => {
    test("authenticates to an ssh server", async ({ approval }) => {
      const key = keyOf(type);

      // When ssh logs in with the key, and the user authorizes it
      const login = ssh.login(key);
      await approval.authorize(key, SshRequestOrigin.Local);

      // Then the server accepts the agent's signature
      const result = await login;
      expect(result.code, result.stderr).toBe(0);
    });

    test("signs a file", async ({ approval }) => {
      const key = keyOf(type);
      const file = join(dir, `signed-${type}.txt`);
      writeFileSync(file, SIGNED_CONTENTS);

      // When ssh-keygen signs a file with the key, and the user authorizes it
      const sign = ssh.signFile(key, file);
      await approval.authorize(key, SshRequestOrigin.Local);
      const signed = await sign;
      expect(signed.code, signed.stderr).toBe(0);

      // Then the signature verifies against the key
      const verified = await ssh.verifyFile(key, file, SIGNED_CONTENTS);
      expect(verified.code, verified.stderr).toBe(0);
    });

    test("authenticates through a forwarded agent", async ({ approval }) => {
      const key = keyOf(type);

      // When ssh logs in with agent forwarding, and from there logs in again
      const login = ssh.loginForwarded(key);

      // Then the user authorizes the first login, and the second as forwarded
      await approval.authorize(key, SshRequestOrigin.Local);
      await approval.authorize(key, SshRequestOrigin.Forwarded);

      const result = await login;
      expect(result.code, result.stderr).toBe(0);
    });
  });
}

test("refuses to authenticate when the user denies the request", async ({ approval }) => {
  const key = keyOf(SshKeyType.Ed25519);

  // When ssh logs in with the key, and the user denies it
  const login = ssh.login(key);
  await approval.deny(key, SshRequestOrigin.Local);

  // Then the server never sees a signature
  const result = await login;
  expect(result.code).toBe(SSH_LOGIN_FAILED);
});
