import { ElectronApplication, Page } from "@playwright/test";

import { LockScreen } from "../lock-screen";

import { clickMenuItem, MenuItem } from "./app-menu";
import { reloadedWindow } from "./fixtures";

/**
 * Whether locking ends in a process reload. Locking reloads unless something must survive
 * in memory, e.g. an ephemeral PIN.
 */
export const LockOutcome = Object.freeze({
  Reload: "reload",
  NoReload: "noReload",
} as const);
export type LockOutcome = (typeof LockOutcome)[keyof typeof LockOutcome];

// Matches the lock screen's own wait, so a missing crash fails instead of hanging.
const CRASH_TIMEOUT_MS = 60_000;

/**
 * Locks every account from the app menu, then returns the window showing the lock screen.
 *
 * The caller states the `expected` outcome, because the page cannot tell: the lock screen
 * renders in the old renderer before the reload crashes it, so "lock screen shown" does not
 * mean "no reload is coming". A reload crashes the renderer, so the reloaded one is reached
 * through {@link reloadedWindow}.
 */
export async function lockAll(
  app: ElectronApplication,
  window: Page,
  expected: LockOutcome,
): Promise<Page> {
  if (expected === LockOutcome.NoReload) {
    // A crash means the lock reloaded after all; say so instead of timing out on the page.
    const unexpectedReload = window.waitForEvent("crash").then(() => {
      throw new Error("Locking reloaded the app, but no reload was expected");
    });

    await clickMenuItem(app, MenuItem.LockAll);
    await Promise.race([new LockScreen(window).waitUntilShown(), unexpectedReload]);
    return window;
  }

  // Armed before the click, so the crash cannot be missed.
  const reload = watchReload(window);
  await clickMenuItem(app, MenuItem.LockAll);

  const reloaded = await reload();
  await new LockScreen(reloaded).waitUntilShown();
  return reloaded;
}

/**
 * Waits for the process reload of the next lock, wherever it comes from, e.g. the extension
 * through shared unlock. Call before locking; the returned function resolves to the reloaded
 * window, since `window` is dead after the crash.
 */
export function watchReload(window: Page): () => Promise<Page> {
  const crashed = window.waitForEvent("crash", { timeout: CRASH_TIMEOUT_MS });

  return async () => {
    await crashed;
    return reloadedWindow();
  };
}
