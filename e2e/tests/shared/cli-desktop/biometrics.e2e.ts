import { expect, test } from "../../../src/cli/fixtures";
import { BiometricRequestType, Biometrics } from "../../../src/desktop/biometrics";
import { lockAll, LockOutcome } from "../../../src/desktop/lock";
import { DesktopSettings } from "../../../src/desktop/settings";
import { FeatureFlag } from "../../../src/feature-flags";
import { logInToDesktop } from "../../../src/shared/clients";

/**
 * `bw unlock` unlocks with the desktop app's biometrics, which it asks for over SDK IPC. This is
 * the fallback a locked desktop app leaves the CLI with: shared unlock answers "locked", and the
 * biometric prompt follows.
 */

const FLAGS = [FeatureFlag.SharedUnlock];

test.describe("CLI unlock with desktop biometrics", () => {
  test.setTimeout(300_000);
  test.use({ cliFlags: FLAGS });

  test("unlocks with the desktop app's biometrics", async ({ app, biometrics, cli, window }) => {
    // The CLI locks before the desktop app signs in: its lock propagates there too.
    await cli.logIn();
    await cli.lock();
    await logInToDesktop(window, FLAGS);

    const settings = new DesktopSettings(app, window);
    await settings.open();
    await settings.enableBiometrics(biometrics);
    await settings.close();

    const desktop = await lockAll(app, window, LockOutcome.Reload);

    // The fake biometrics live in the renderer, so drive the reloaded one.
    const desktopBiometrics = new Biometrics(desktop);
    const [unlock] = await Promise.all([
      cli.unlockInteractively(),
      desktopBiometrics.approveNext(BiometricRequestType.Unlock),
    ]);

    expect(unlock.code).toBe(0);
    await expect(cli.status(unlock.stdout.trim())).resolves.toMatchObject({ status: "unlocked" });
  });
});
