import { BrowserContext, Page } from "@playwright/test";

import { LockScreen } from "../lock-screen";

import { extensionShutdown, popupUrl, reopenPopup } from "./fixtures";

// The popup header avatar carries the account as screen-reader text, e.g. "Bitwarden account a@b.c".
const CURRENT_ACCOUNT = /Bitwarden account/;
// An inactive account's row reads "Switch to account <email> <server> (Locked)".
const SWITCH_TO_ACCOUNT = /Switch to account/;
// Matches the lock screen's own wait, so "neither happened" fails instead of hanging.
const CLOSE_TIMEOUT_MS = 60_000;

/** Locks the active account from the popup's account switcher. */
export async function lockNow(popup: Page) {
  await popup.getByRole("button", { name: CURRENT_ACCOUNT }).click();
  await popup.getByRole("button", { name: "Lock now" }).click();
}

/**
 * Locks, then reopens the popup, as a user clicking the toolbar icon again would: locking
 * closes every popup and restarts the extension to wipe it from memory.
 */
export async function lockAndReopen(context: BrowserContext, popup: Page): Promise<Page> {
  const url = await popupUrl(context);
  const shutdown = extensionShutdown(context);
  await lockNow(popup);
  await shutdown;

  return reopenPopup(context, url);
}

/** Opens the popup's account switcher, where the account options and the account list live. */
async function openAccountSwitcher(popup: Page) {
  await popup.getByRole("button", { name: CURRENT_ACCOUNT }).click();
}

/** Starts signing in another account from the popup's account switcher. */
export async function addAccount(popup: Page) {
  await openAccountSwitcher(popup);
  await popup.getByRole("button", { name: "Add account" }).click();
}

/** Switches to the inactive account `email` from the popup's account switcher. */
export async function switchAccount(popup: Page, email: string) {
  await openAccountSwitcher(popup);
  await popup.getByRole("button", { name: SWITCH_TO_ACCOUNT }).filter({ hasText: email }).click();
}

/**
 * Locks every account, then returns a popup showing the lock screen. Locking ends in an
 * extension restart unless something must survive in memory; a restart closes the popup,
 * so a fresh one is opened, as a user clicking the toolbar icon again would.
 */
export async function lockAll(context: BrowserContext, popup: Page): Promise<Page> {
  const url = await popupUrl(context);

  // Armed before the click, so neither event can be missed.
  const restarted = Promise.all([
    popup.waitForEvent("close", { timeout: CLOSE_TIMEOUT_MS }),
    extensionShutdown(context),
  ]).then(() => Outcome.Restarted);
  const locked = new LockScreen(popup).waitUntilShown().then(() => Outcome.Locked);

  await openAccountSwitcher(popup);
  await popup.getByRole("button", { name: "Lock all" }).click();

  // The first outcome that happens wins. A rejection only means that outcome did not
  // happen, e.g. the lock screen wait dies with the closed popup; both failing is an error.
  const outcome: Outcome = await Promise.any([restarted, locked]);
  if (outcome === Outcome.Locked) {
    return popup;
  }

  const reopened = await reopenPopup(context, url);
  await new LockScreen(reopened).waitUntilShown();
  return reopened;
}

const Outcome = Object.freeze({
  Restarted: "restarted",
  Locked: "locked",
} as const);
type Outcome = (typeof Outcome)[keyof typeof Outcome];
