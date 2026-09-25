import { test } from "@playwright/test";

import { AccountName, account } from "../../src/credentials";
import { LockScreen } from "../../src/lock-screen";
import { LoginPage, ServerChoice } from "../../src/login";
import { measureLockCycles, reportLockCycles } from "../../src/perf";
import { lockNow } from "../../src/web/account-menu";
import {
  SETUP_EXTENSION_URL,
  skipExtensionSetup,
  skipOnboardingDialogs,
} from "../../src/web/onboarding";

const VAULT_URL = /#\/vault/;
const LOCK_URL = /#\/lock/;
const POST_LOGIN_URL = new RegExp(`${VAULT_URL.source}|${SETUP_EXTENSION_URL.source}`);
const POST_LOGIN_TIMEOUT_MS = 60_000;

test("measures lock and master password unlock", async ({ page }) => {
  test.setTimeout(300_000);

  const user = account(AccountName.Local);
  const login = new LoginPage(page);
  const lockScreen = new LockScreen(page);
  await skipOnboardingDialogs(page);

  await page.goto("/");
  await login.logIn(user, ServerChoice.Fixed);
  await page.waitForURL(POST_LOGIN_URL, { timeout: POST_LOGIN_TIMEOUT_MS });
  await skipExtensionSetup(page);
  await login.waitForVault(VAULT_URL);

  const cycles = await measureLockCycles(
    async () => {
      await lockNow(page);
      await page.waitForURL(LOCK_URL);
      await lockScreen.waitUntilShown();
    },
    async () => {
      await lockScreen.unlockWithMasterPassword(user.password);
      await page.waitForURL(VAULT_URL);
    },
  );

  reportLockCycles("web", cycles);
});
