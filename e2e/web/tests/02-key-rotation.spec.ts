import { expect, test } from "@playwright/test";

import { AutomationDriver } from "../../utils/automation-driver";
import { Account, readAccount } from "../../utils/credentials";
import { LOGIN_ROUTE, VAULT_ROUTE } from "../../utils/routes";
import { USER_KEY_ID } from "../../utils/state-addresses";
import { ensureLoggedIn } from "../utils/login";

const ACCOUNT_NAME = "local";

const SECURITY_KEYS_ROUTE = "/#/settings/security/security-keys";
const ROTATE_KEY_TEXT = /^rotate key$/i;
const ROTATE_DIALOG_TEXT = /^rotate account encryption key$/i;
const MASTER_PASSWORD_INPUT = 'input[name="masterPassword"]';

let account: Account;

test.beforeAll(() => {
  account = readAccount(ACCOUNT_NAME);
});

test("rotates the account encryption key", async ({ page }) => {
  const driver = new AutomationDriver(page);

  await page.goto("/");
  await ensureLoggedIn(page, account);

  const keyIdBefore = await readUserKeyId(driver);
  expect(keyIdBefore).not.toBeNull();

  await page.goto(SECURITY_KEYS_ROUTE);
  await page.getByRole("button", { name: ROTATE_KEY_TEXT }).click();

  const dialog = page.getByRole("dialog", { name: ROTATE_DIALOG_TEXT });
  await dialog.locator(MASTER_PASSWORD_INPUT).fill(account.password);
  await dialog.getByRole("button", { name: ROTATE_KEY_TEXT }).click();

  // A successful rotation logs the user out, so logging back in proves the new
  // key decrypts the account — under a key id that is not the old one.
  await expect(page).toHaveURL(LOGIN_ROUTE);

  // The forced logout leaves the app mid-teardown; reload for a clean instance.
  await page.goto("/");
  await ensureLoggedIn(page, account);
  await expect(page).toHaveURL(VAULT_ROUTE);

  expect(await readUserKeyId(driver)).not.toEqual(keyIdBefore);
});

async function readUserKeyId(driver: AutomationDriver): Promise<unknown> {
  const [user] = await driver.listUsers();

  return await driver.readUserState(user.userId, USER_KEY_ID);
}
