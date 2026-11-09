import { clientAccounts } from "../../src/accounts";
import { expect, test } from "../../src/desktop/fixtures";
import {
  buildRunner,
  duckDuckGoUnavailable,
  HandshakeApproval,
  RunnerCommand,
  RunnerLog,
  runCommand,
} from "../../src/desktop/native-messaging-runner";
import { DesktopSettings } from "../../src/desktop/settings";
import { disableFlags, FeatureFlag } from "../../src/feature-flags";
import { LoginPage } from "../../src/login";

/**
 * The DuckDuckGo browser integration, driven by the desktop app's native messaging test runner
 * in DuckDuckGo's place. Every command handshakes first, which the user must approve.
 */

const VAULT_URL = /#\/vault/;
const RETRIEVE_URI = "https://example.com";
// Building the runner compiles part of libs/common.
const BUILD_TIMEOUT_MS = 300_000;

test.describe("DuckDuckGo native messaging", () => {
  const unavailable = duckDuckGoUnavailable();
  test.skip(unavailable != null, unavailable);

  test.beforeAll(async () => {
    test.setTimeout(BUILD_TIMEOUT_MS);
    await buildRunner();
  });

  let approval: HandshakeApproval;

  test.beforeEach(async ({ app, window }) => {
    // The redesigned vault's onboarding opens dialogs after login, over or under the handshake.
    await disableFlags(window, [FeatureFlag.VFO1Foundation]);

    const login = new LoginPage(window);
    await login.logIn();
    await login.waitForVault(VAULT_URL);

    const settings = new DesktopSettings(app, window);
    await settings.open();
    await settings.enableDuckDuckGo();
    await settings.close();

    approval = new HandshakeApproval(window);
  });

  test("handshakes when the user approves", async () => {
    const handshake = runCommand(RunnerCommand.Handshake);
    await approval.approve();

    const { stdout } = await handshake;
    expect(stdout).toContain(RunnerLog.HandshakeSucceeded);
  });

  test("refuses the handshake when the user denies it", async () => {
    const handshake = runCommand(RunnerCommand.Handshake);
    await approval.deny();

    const { stdout } = await handshake;
    expect(stdout).toContain(RunnerLog.HandshakeCanceled);
    expect(stdout).not.toContain(RunnerLog.HandshakeSucceeded);
  });

  test("reports the vault status", async () => {
    const status = runCommand(RunnerCommand.Status);
    await approval.approve();

    const { stdout } = await status;
    expect(stdout).toContain(RunnerLog.Status);
  });

  test("retrieves credentials for a URI", async () => {
    const retrieve = runCommand(RunnerCommand.RetrieveCredentials, ["--uri", RETRIEVE_URI]);
    await approval.approve();

    const { stdout } = await retrieve;
    expect(stdout).toContain(RunnerLog.CredentialsReturned);
  });

  test("generates a password for the active user", async ({ window }) => {
    const [user] = (await clientAccounts(window)).filter((a) => a.status === "Unlocked");

    const generate = runCommand(RunnerCommand.GeneratePassword, ["--userId", user.userId]);
    await approval.approve();

    const { stdout } = await generate;
    expect(stdout).toContain(RunnerLog.PasswordGenerated);
  });
});
