import { expect, test } from "../../../src/cli/fixtures";
import { account } from "../../../src/credentials";
import { lockAll, LockOutcome, watchReload } from "../../../src/desktop/lock";
import { FeatureFlag } from "../../../src/feature-flags";
import { LockScreen } from "../../../src/lock-screen";
import { logInToDesktop } from "../../../src/shared/clients";

/**
 * `bw unlock` adopts the desktop app's session over shared unlock, and the CLI's own lock and
 * unlock reach the desktop app. The CLI talks to it over SDK IPC, through the native messaging
 * proxy.
 *
 * The three states the CLI has to tell apart:
 *
 *   desktop unlocked    ──▶ its user key arrives, the CLI unlocks without a password
 *   desktop locked      ──▶ it answers "locked", the CLI asks for a password at once
 *   desktop not running ──▶ nothing answers, the CLI asks for a password
 *
 * `cli.lock()` propagates to the desktop app, so every test locks the CLI before the desktop
 * app is signed in, never after.
 */

const FLAGS = [FeatureFlag.SharedUnlock];
const NO_PASSWORD_MESSAGE = "Master password is required";

test.describe("shared unlock between the CLI and the desktop app", () => {
  test.setTimeout(300_000);
  test.use({ cliFlags: FLAGS });

  test("unlocks from an unlocked desktop app, with no password", async ({ cli, window }) => {
    await cli.logIn();
    await cli.lock();
    await logInToDesktop(window, FLAGS);

    const unlock = await cli.unlockFromDesktop();

    expect(unlock.code).toBe(0);
    await expect(cli.status(unlock.stdout.trim())).resolves.toMatchObject({ status: "unlocked" });
  });

  test("asks for a password when the desktop app is locked", async ({ app, cli, window }) => {
    await cli.logIn();
    await cli.lock();
    await logInToDesktop(window, FLAGS);
    await lockAll(app, window, LockOutcome.Reload);

    const unlock = await cli.unlockFromDesktop();

    // A locked peer answers; the CLI must not sit waiting for an unlock that is not coming.
    expect(unlock.code).not.toBe(0);
    expect(unlock.stderr + unlock.stdout).toContain(NO_PASSWORD_MESSAGE);
  });

  test("asks for a password when the desktop app is not running", async ({ cli }) => {
    // Asks for no desktop fixture, so no app is launched for this test.
    await cli.logIn();
    await cli.lock();

    const unlock = await cli.unlockFromDesktop();

    expect(unlock.code).not.toBe(0);
    expect(unlock.stderr + unlock.stdout).toContain(NO_PASSWORD_MESSAGE);
  });

  test("unlocking the CLI unlocks a locked desktop app", async ({ app, cli, window }) => {
    await cli.logIn();
    await cli.lock();
    await logInToDesktop(window, FLAGS);

    const desktopLock = new LockScreen(await lockAll(app, window, LockOutcome.Reload));
    await desktopLock.waitUntilShown();

    const unlock = await cli.unlockWithPassword(account().password);

    expect(unlock.code).toBe(0);
    await desktopLock.waitUntilGone();
  });

  test("locking the CLI locks the desktop app", async ({ cli, window }) => {
    await cli.logIn();
    await logInToDesktop(window, FLAGS);

    // The desktop app reloads its process on every lock, wherever the lock came from.
    const desktopReload = watchReload(window);
    await cli.lock();

    await new LockScreen(await desktopReload()).waitUntilShown();
  });
});
