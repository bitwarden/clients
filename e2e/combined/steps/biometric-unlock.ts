import { existsSync } from "node:fs";
import path from "node:path";

import { expect } from "@playwright/test";

import { popupUrl } from "../../browser/utils/app";
import { ensureLoggedIn as ensureBrowserLoggedIn } from "../../browser/utils/login";
import {
  enableUnlockSetting,
  expectUnlockSetting,
  UnlockSetting,
} from "../../browser/utils/unlock-methods";
import { enableBiometrics as enableDesktopBiometrics } from "../../desktop/utils/biometrics";
import { BiometricsStatus } from "../../utils/automation-driver";
import { readAccount } from "../../utils/credentials";
import { BIOMETRIC_UNLOCK_TEXT } from "../../utils/lock-screen";
import { ensureUnlocked } from "../../utils/login";
import { VAULT_ROUTE } from "../../utils/routes";
import { Given, Then, When } from "../utils/bdd";
import { waitForPopup } from "../utils/popup";

////
// Steps for the scenarios that need the desktop app and the browser extension
// running at once. Biometric unlock that each client does on its own lives in
// the unsuffixed features, which the desktop and browser suites run.
//
// "the vault" means the browser extension's vault: it is the client under test,
// and the desktop app is the biometric backend standing behind it.
////

const SHARED_UNLOCK_FLAG = "innovation-sprint-shared-unlock-part-2";

const ACCOUNT_SWITCHER_ROUTE = "account-switcher";
const LOCK_NOW_TEXT = /^lock now$/i;
const LOCKED_HEADING_TEXT = /your vault is locked/i;

// `start.js` writes this manifest into the debug Chrome profile once it knows the
// extension id. Without it the popup cannot reach the desktop app at all.
const MANIFEST_PATH = path.resolve(
  __dirname,
  "../../..",
  ".debug/chrome-profile/NativeMessagingHosts/com.8bit.bitwarden.json",
);

/** The Gherkin names of the two settings that route browser unlock to the desktop. */
const SETTING_BY_NAME: Record<string, UnlockSetting> = {
  "biometric unlock": UnlockSetting.BiometricUnlock,
  "unlock sharing with the desktop": UnlockSetting.UnlockSharingWithDesktop,
};

function settingByName(name: string): UnlockSetting {
  const setting = SETTING_BY_NAME[name];

  if (setting == null) {
    throw new Error(`Unknown unlock setting: ${name}`);
  }

  return setting;
}

Given("the browser extension has permission to use native messaging", () => {
  // Granted by the launcher, not by a scenario, so this only reports whether the
  // pairing it was supposed to set up is actually in place.
  expect(existsSync(MANIFEST_PATH), `No native messaging manifest at ${MANIFEST_PATH}`).toBe(true);
});

Given(
  "the shared unlock feature is {word} in the browser",
  async ({ extensionDriver }, state: string) => {
    // The flag decides which setting the account security page shows, and the dev
    // server's own value would decide it for us, so it is pinned per scenario.
    // The override is global state the popup reads reactively, so no reload: a
    // reload drops the routed hash the popup URLs are built from.
    await extensionDriver.setFeatureFlag(SHARED_UNLOCK_FLAG, state === "on");
  },
);

Given(
  "I have an unlocked vault as the {string} account",
  async ({ desktop, extension }, name: string) => {
    const account = readAccount(name);

    // Both, and the desktop app first: it answers the biometric prompt, so the
    // browser extension cannot be unlocked by biometrics without it.
    await ensureUnlocked(desktop, account);

    const popup = await extension();
    await ensureBrowserLoggedIn(popup, account);
    await expect(popup).toHaveURL(VAULT_ROUTE);
  },
);

Given("desktop biometric unlock is enabled", async ({ desktop, driver }) => {
  // Enrollment reads the hardware status, so it has to look usable first.
  await driver.biometrics.setStatus(BiometricsStatus.Available);
  await enableDesktopBiometrics(desktop, driver);
});

Given("{} is enabled in the browser", async ({ extension }, name: string) => {
  await enableUnlockSetting(await extension(), settingByName(name));
});

Given("the vault is locked", async ({ extension }) => {
  // The extension locks from the account switcher, as a user does. That closes the
  // popup, so the lock screen is asserted on whichever popup comes back.
  const popup = await extension();
  await popup.goto(popupUrl(popup.url(), ACCOUNT_SWITCHER_ROUTE));
  await popup.getByRole("button", { name: LOCK_NOW_TEXT }).click();

  await waitForPopup(extension, (page) =>
    page.getByRole("heading", { name: LOCKED_HEADING_TEXT }).isVisible(),
  );
});

When("I enable biometric unlock", async ({ extension }) => {
  await enableUnlockSetting(await extension(), UnlockSetting.BiometricUnlock);
});

When("I unlock with biometrics", async ({ extension, driver }) => {
  // Offered only once the desktop app has answered that biometrics are
  // available, which is a round trip over native messaging. The click then
  // blocks until the desktop app answers again, so approve the prompt it queues
  // while the click is still pending.
  await waitForPopup(extension, (page) =>
    page.getByRole("button", { name: BIOMETRIC_UNLOCK_TEXT }).isEnabled(),
  );

  const popup = await extension();
  await popup.getByRole("button", { name: BIOMETRIC_UNLOCK_TEXT }).click();

  await expect.poll(async () => (await driver.biometrics.listPending()).length).toBeGreaterThan(0);

  await driver.biometrics.approve();
});

Then("biometric unlock is enabled", async ({ extension }) => {
  await expectUnlockSetting(await extension(), UnlockSetting.BiometricUnlock, true);
});

Then("the biometric unlock button is not offered", async ({ extension }) => {
  const popup = await extension();
  const button = popup.getByRole("button", { name: BIOMETRIC_UNLOCK_TEXT });

  // Hidden or present-but-disabled both count: the point is that it cannot be used.
  if (await button.isVisible()) {
    await expect(button).toBeDisabled();
  }
});

Then("the vault is shown", async ({ extension }) => {
  await waitForPopup(extension, async (page) => VAULT_ROUTE.test(page.url()));
});

// Deliberately undefined, so those scenarios report as skipped rather than
// failing. They need two accounts in .debug/e2e-credentials.txt and a helper to
// switch the active one on each client, neither of which exists yet:
//   Given the following accounts are logged in to both clients:
//   Given desktop biometric unlock is enabled for the {string} account
//   Given biometric unlock is enabled in the browser for the {string} account
//   Given the desktop app is active as the {string} account
//   Then the vault is shown as the {string} account
