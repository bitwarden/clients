import { expect, test } from "@playwright/test";

import { AttachedApp } from "../../utils/cdp";
import { Account, readAccount } from "../../utils/credentials";
import { unlockWithPin } from "../../utils/lock-screen";
import { PinEnvelope } from "../../utils/pin-envelope";
import { LOCK_ROUTE } from "../../utils/routes";
import { attachToPopup, popupUrl } from "../utils/app";
import { ensureLoggedIn } from "../utils/login";
import { disablePin, enablePin } from "../utils/pin";

const ACCOUNT_NAME = "default";
const PIN = "1234";

const ACCOUNT_SWITCHER_ROUTE = "account-switcher";
const LOCK_NOW_TEXT = /^lock now$/i;

let app: AttachedApp;
let account: Account;

test.beforeAll(async () => {
  app = await attachToPopup();
  account = readAccount(ACCOUNT_NAME);
});

test.beforeEach(async () => {
  await ensureLoggedIn(app.page, account);
});

test.afterEach(async () => {
  await disablePin(app.page);
});

test.afterAll(async () => {
  await app?.detach();
});

test("unlocks with a PIN", async () => {
  const { page } = app;

  await enablePin(page, PIN, PinEnvelope.Ephemeral);

  await lockVault(page);
  await unlockWithPin(page, PIN);
});

/** The extension locks from the account switcher, as a user does. */
async function lockVault(page: typeof app.page): Promise<void> {
  await page.goto(popupUrl(page.url(), ACCOUNT_SWITCHER_ROUTE));
  await page.getByRole("button", { name: LOCK_NOW_TEXT }).click();

  await expect(page).toHaveURL(LOCK_ROUTE);
}
