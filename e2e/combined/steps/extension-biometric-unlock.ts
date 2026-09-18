import { expect } from "@playwright/test";

import { popupUrl } from "../../browser/utils/app";
import { ensureLoggedIn as ensureExtensionLoggedIn } from "../../browser/utils/login";
import { enableUnlockSetting, UnlockSetting } from "../../browser/utils/unlock-methods";
import { enableBiometrics as enableDesktopBiometrics } from "../../desktop/utils/biometrics";
import { BiometricsStatus } from "../../utils/automation-driver";
import { readAccount } from "../../utils/credentials";
import { BIOMETRIC_UNLOCK_TEXT } from "../../utils/lock-screen";
import { ensureUnlocked } from "../../utils/login";
import { VAULT_ROUTE } from "../../utils/routes";
import { Given, Then, When } from "../utils/bdd";
import { waitForPopup } from "../utils/popup";

const SHARED_UNLOCK_FLAG = "innovation-sprint-shared-unlock-part-2";

const ACCOUNT_SWITCHER_ROUTE = "account-switcher";
const LOCK_NOW_TEXT = /^lock now$/i;
const LOCKED_HEADING_TEXT = /your vault is locked/i;

/** The Gherkin names of the two settings that route extension unlock to the desktop. */
const SETTING_BY_NAME: Record<string, UnlockSetting> = {
  "biometric unlock": UnlockSetting.BiometricUnlock,
  "unlock sharing with the desktop": UnlockSetting.UnlockSharingWithDesktop,
};

Given(
  "the shared unlock feature is {word} in the extension",
  async ({ extensionDriver }, state: string) => {
    // The flag decides which setting the account security page shows, and the dev
    // server's own value would decide it for us, so it is pinned per scenario.
    // The override is global state the popup reads reactively, so no reload: a
    // reload drops the routed hash the popup URLs are built from.
    await extensionDriver.setFeatureFlag(SHARED_UNLOCK_FLAG, state === "on");
  },
);

Given("the desktop is unlocked as the {string} account", async ({ desktop }, name: string) => {
  await ensureUnlocked(desktop, readAccount(name));
});

Given("desktop biometric unlock is enabled", async ({ desktop, driver }) => {
  await driver.biometrics.setStatus(BiometricsStatus.Available);
  await enableDesktopBiometrics(desktop, driver);
});

Given("the extension is unlocked as the {string} account", async ({ extension }, name: string) => {
  const popup = await extension();

  await ensureExtensionLoggedIn(popup, readAccount(name));
  await expect(popup).toHaveURL(VAULT_ROUTE);
});

When("I enable {} in the extension", async ({ extension }, name: string) => {
  const setting = SETTING_BY_NAME[name];

  if (setting == null) {
    throw new Error(`Unknown unlock setting: ${name}`);
  }

  await enableUnlockSetting(await extension(), setting);
});

When("I lock the extension", async ({ extension }) => {
  // The extension locks from the account switcher, as a user does. That closes the
  // popup, so the lock screen is asserted on whichever popup comes back.
  const popup = await extension();
  await popup.goto(popupUrl(popup.url(), ACCOUNT_SWITCHER_ROUTE));
  await popup.getByRole("button", { name: LOCK_NOW_TEXT }).click();

  await waitForPopup(extension, (page) =>
    page.getByRole("heading", { name: LOCKED_HEADING_TEXT }).isVisible(),
  );
});

Then("the extension lock screen offers biometric unlock", async ({ extension }) => {
  // Offered only once the desktop app has answered that biometrics are usable,
  // which is a round trip over native messaging.
  await waitForPopup(extension, (page) =>
    page.getByRole("button", { name: BIOMETRIC_UNLOCK_TEXT }).isEnabled(),
  );
});

When(
  "I unlock the extension with biometrics, approving on the desktop",
  async ({ extension, driver }) => {
    // The click blocks until the desktop app answers, so approve the prompt it
    // queues while the click is still pending.
    const popup = await extension();
    await popup.getByRole("button", { name: BIOMETRIC_UNLOCK_TEXT }).click();

    await expect
      .poll(async () => (await driver.biometrics.listPending()).length)
      .toBeGreaterThan(0);

    await driver.biometrics.approve();
  },
);

Then("the extension vault is shown", async ({ extension }) => {
  await waitForPopup(extension, async (page) => VAULT_ROUTE.test(page.url()));
});
