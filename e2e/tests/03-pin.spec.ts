import { expect, test } from "@playwright/test";

import { AutomationDriver } from "../utils/automation-driver";
import { Account, readAccount } from "../utils/credentials";
import { attachToDesktop, DesktopApp } from "../utils/desktop";
import {
  offersUnlockOption,
  UnlockOption,
  unlockWithMasterPassword,
  unlockWithPin,
} from "../utils/lock-screen";
import { ensureLoggedIn } from "../utils/login";
import { disablePin, enablePin, PinEnvelope } from "../utils/pin";

const ACCOUNT_NAME = "default";
const PIN = "1234";

const LOCK_ROUTE = /#\/lock/;
const VAULT_ROUTE = /#\/vault/;

let app: DesktopApp;
let driver: AutomationDriver;
let account: Account;

test.beforeAll(async () => {
  app = await attachToDesktop();
  driver = new AutomationDriver(app.page);
  account = readAccount(ACCOUNT_NAME);
});

test.beforeEach(async () => {
  await ensureLoggedIn(app.page, account);
});

test.afterEach(async () => {
  await disablePin(app.page, driver);
});

test.afterAll(async () => {
  await app?.detach();
});

test("unlocks with an after-first-unlock PIN until a restart", async () => {
  const { page } = app;

  await enablePin(page, driver, PIN, PinEnvelope.Ephemeral);

  await driver.lockVault();
  await expect(page).toHaveURL(LOCK_ROUTE);
  await unlockWithPin(page, PIN);

  // The envelope only ever lived in memory, so a restart leaves the master password.
  await driver.enterAfuMode();
  await expect(page).toHaveURL(LOCK_ROUTE);
  expect(await offersUnlockOption(page, UnlockOption.Pin)).toBe(false);

  await unlockWithMasterPassword(page, account.password);
});

test("unlocks with a before-first-unlock PIN after a restart", async () => {
  const { page } = app;

  await enablePin(page, driver, PIN, PinEnvelope.Persistent);

  await driver.lockVault();
  await expect(page).toHaveURL(LOCK_ROUTE);
  await unlockWithPin(page, PIN);

  // The envelope is on disk, so the PIN survives the restart.
  await driver.enterAfuMode();
  await expect(page).toHaveURL(LOCK_ROUTE);
  expect(await offersUnlockOption(page, UnlockOption.Pin)).toBe(true);

  await unlockWithPin(page, PIN);
  await expect(page).toHaveURL(VAULT_ROUTE);
});
