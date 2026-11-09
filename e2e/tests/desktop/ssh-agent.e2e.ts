import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { dismissNewLookDialog } from "../../src/desktop/onboarding";
import { DesktopSettings } from "../../src/desktop/settings";
import { expect, SshRequestOrigin, test } from "../../src/desktop/ssh-agent";
import { useWideWindow } from "../../src/desktop/window";
import { LoginPage } from "../../src/login";
import { keysByType, SshKey, SshKeyType } from "../../src/ssh/keys";
import { listAgentKeys, SshClient } from "../../src/ssh/ssh-client";
import { SshServer } from "../../src/ssh/ssh-server";

/**
 * The desktop SSH agent serves the vault's SSH keys to OpenSSH's own tools, asking the user
 * to approve each use. The test account's vault holds an ED25519, an ECDSA and an RSA key, and
 * every test pins one, so a test can only pass with the key it names.
 */

const VAULT_URL = /#\/vault/;
// ssh exits 255 when it cannot log in, e.g. because the agent refused to sign.
const SSH_LOGIN_FAILED = 255;
const SIGNED_CONTENTS = "signed by the Bitwarden SSH agent\n";
const KEY_TYPES = Object.values(SshKeyType);

let dir: string;
let server: SshServer | undefined;
let keys: Map<SshKeyType, SshKey>;
let ssh: SshClient;

test.beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "bw-ssh-e2e-"));
});

test.afterAll(() => {
  server?.stop();
  rmSync(dir, { recursive: true, force: true });
});

test.beforeEach(async ({ app, window, agentSocket }) => {
  await useWideWindow(app);

  const login = new LoginPage(window);
  await login.logIn();
  await login.waitForVault(VAULT_URL);
  await dismissNewLookDialog(window);

  const settings = new DesktopSettings(app, window);
  await settings.open();
  await settings.enableSshAgent();
  await settings.close();

  // The agent starts and loads the vault's keys asynchronously after the setting is saved.
  await expect
    .poll(
      async () => {
        keys = keysByType((await listAgentKeys(agentSocket)).stdout, dir);
        return keys.size;
      },
      { message: "The test account needs an ED25519, an ECDSA and an RSA SSH key" },
    )
    .toBe(KEY_TYPES.length);

  // The server trusts the keys the account's vault holds.
  server ??= await SshServer.start(dir, [...keys.values()]);
  ssh = new SshClient(dir, agentSocket, server);
});

const keyOf = (type: SshKeyType) => keys.get(type)!;

for (const type of KEY_TYPES) {
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
