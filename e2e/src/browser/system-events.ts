import { BrowserContext, Page } from "@playwright/test";

import { automationDriver } from "../automation-driver";

import { popupUrl, reopenPopup, watchShutdown } from "./fixtures";

const CLOSE_TIMEOUT_MS = 30_000;

/**
 * Whether reporting a locked screen ends in an extension restart. Logging out or locking
 * restarts the extension unless an account stays unlocked; a report that changes nothing does
 * not restart it.
 */
export const LockScreenOutcome = Object.freeze({
  Restart: "restart",
  NoRestart: "noRestart",
} as const);
export type LockScreenOutcome = (typeof LockScreenOutcome)[keyof typeof LockScreenOutcome];

type SystemEventsCapability = {
  lockScreen(): Promise<void>;
};

/**
 * Reports a locked screen to the extension background, which handles it as `chrome.idle`
 * "locked", and returns the popup that is open afterwards.
 *
 * The caller states the `expected` outcome, because the answer cannot tell: the background
 * answers once it has asked for the restart, and the restart follows shortly after.
 */
export async function lockScreen(
  context: BrowserContext,
  popup: Page,
  expected: LockScreenOutcome,
): Promise<Page> {
  const capability = automationDriver<SystemEventsCapability>(popup, "systemEvents");

  if (expected === LockScreenOutcome.NoRestart) {
    await capability.lockScreen();
    return popup;
  }

  const url = await popupUrl(context);
  const shutdown = await watchShutdown(context);
  // Armed before the event, so the restart cannot be missed.
  const closed = popup.waitForEvent("close", { timeout: CLOSE_TIMEOUT_MS });

  await Promise.all([closed, shutdown(), lockScreenIgnoringClosedPopup(capability)]);
  return reopenPopup(context, url);
}

/** The answer can die with the popup; the restart is what the caller waits for. */
async function lockScreenIgnoringClosedPopup(capability: SystemEventsCapability) {
  try {
    await capability.lockScreen();
  } catch {
    // The popup closed before the answer arrived.
  }
}
