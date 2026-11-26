import { AccountSecurityPage } from "../../../src/browser/account-security";
import { lockNow as lockExtensionNow } from "../../../src/browser/account-switcher";
import { popupUrl, reopenPopup, watchShutdown } from "../../../src/browser/fixtures";
import { DesktopSettings } from "../../../src/desktop/settings";
import { FeatureFlag } from "../../../src/feature-flags";
import { LockScreen } from "../../../src/lock-screen";
import {
  desktopConnected,
  Extension,
  lockExtension,
  logInToDesktop,
  logInToExtension,
  openExtensionVault,
} from "../../../src/shared/clients";
import {
  bootstrapCompleted,
  slowConnect,
  expect,
  HostMode,
  test,
} from "../../../src/shared/fake-host";

/**
 * Background startup against a desktop app that answers late, or not at all.
 *
 * `MainBackground.bootstrap` awaits `sharedUnlockPeerService.start()`, whose first sync sends over
 * the desktop transport while the connection attempt is still in flight. What the native messaging
 * host does during that window therefore decides whether startup finishes at all.
 *
 * A real `desktop_proxy` cannot be held in that state on demand, so these run against the fake
 * host in src/shared/fake-native-host.mjs.
 */

const FLAGS = [FeatureFlag.SharedUnlock];
// The transport gives the host 5s to report a connection. Well inside it, with room for a loaded
// CI machine.
const SLOW_CONNECT_MS = 2_500;
// Two reconnect intervals, so a startup that only finishes after a retry still counts.
const BOOTSTRAP_TIMEOUT_MS = 30_000;
// The lock screen refreshes its unlock options every second; this covers several of those.
const UNLOCK_OPTIONS_TIMEOUT_MS = 20_000;

test.describe("desktop app that answers late or not at all", () => {
  test.setTimeout(300_000);

  let extension: Extension;

  test.beforeEach(async ({ context, popup, window }) => {
    await logInToDesktop(window, FLAGS);

    extension = await logInToExtension(context, popup, FLAGS);
    const settings = new AccountSecurityPage(extension.popup);
    await settings.open(extension.url);
    await settings.enableDesktopSync();
    await openExtensionVault(extension);
  });

  /** Restarts the extension so it bootstraps against whatever the fake host is doing now. */
  async function restartExtension(context: Parameters<typeof watchShutdown>[0]) {
    const url = await popupUrl(context);
    const shutdown = await watchShutdown(context);
    // `chrome` only exists in extension pages, which the test types do not describe. The reload
    // may close the page before `evaluate` returns.
    await extension.popup
      .evaluate(() => (globalThis as any).chrome.runtime.reload())
      .catch((): void => undefined);
    await shutdown();

    // Opening the popup starts the next instance, and with it bootstrap.
    extension = { popup: await reopenPopup(context, url), url };
  }

  test("finishes startup when the host never reports a connection", async ({
    context,
    hostControl,
  }) => {
    // Transparent first, so a fake host that is broken in `pass` cannot pass for a healthy one.
    hostControl.useFakeHost();
    hostControl.setMode(HostMode.Pass);
    const connected = desktopConnected(context);
    await restartExtension(context);
    await connected();

    hostControl.setMode(HostMode.Silence);
    await restartExtension(context);

    await expect
      .poll(() => bootstrapCompleted(context), {
        timeout: BOOTSTRAP_TIMEOUT_MS,
        message: "Background startup never got past the shared unlock sync",
      })
      .toBe(true);
  });

  test("connects when the host reports a connection slowly", async ({ context, hostControl }) => {
    hostControl.useFakeHost();
    hostControl.setMode(slowConnect(SLOW_CONNECT_MS));
    const connected = desktopConnected(context);
    await restartExtension(context);

    // A connection inside the transport's budget is a connection, however slow.
    await connected();
    await expect
      .poll(() => bootstrapCompleted(context), { timeout: BOOTSTRAP_TIMEOUT_MS })
      .toBe(true);
  });

  test("biometrics go unavailable while the desktop app stops answering, then come back", async ({
    app,
    biometrics,
    context,
    hostControl,
    window,
  }) => {
    const settings = new DesktopSettings(app, window);
    await settings.open();
    await settings.enableBiometrics(biometrics);
    await settings.close();

    hostControl.useFakeHost();
    hostControl.setMode(HostMode.Pass);
    const connected = desktopConnected(context);
    await restartExtension(context);
    await connected();

    extension = await lockExtension(context, extension, () => lockExtensionNow(extension.popup));
    const lock = new LockScreen(extension.popup);
    await lock.waitUntilShown();
    await expect(lock.biometricUnlockButton()).toBeEnabled({ timeout: UNLOCK_OPTIONS_TIMEOUT_MS });

    // The connection stays up and the host stays alive; the desktop app's answers just stop
    // arriving, which is what a wedged or suspended app looks like from here. An unanswered
    // status reads as DesktopDisconnected, which keeps the option on screen but disables it.
    hostControl.setMode(HostMode.Silence);
    await expect(lock.biometricUnlockButton()).toBeDisabled({ timeout: UNLOCK_OPTIONS_TIMEOUT_MS });

    hostControl.setMode(HostMode.Pass);
    await expect(lock.biometricUnlockButton()).toBeEnabled({ timeout: UNLOCK_OPTIONS_TIMEOUT_MS });
  });
});
