import { expect, Locator, Page } from "@playwright/test";

/** Post-login route offering the browser extension, shown until it is dismissed once. */
export const SETUP_EXTENSION_URL = /#\/setup-extension/;

/** Onboarding modals that pop up over the vault after login, and the button dismissing each. */
const ONBOARDING_DIALOGS = [
  { heading: "You're in! Welcome to Bitwarden", dismiss: "Skip" },
  { heading: "Get the extension for easy vault access", dismiss: "Skip" },
  // Introduces the redesigned vault to existing accounts (libs/vault new-experience-dialog).
  { heading: "Bitwarden has a new look", dismiss: "Close" },
  // Tours invite links to an organization's admins in the Admin Console.
  { heading: "Invite your whole team with a single link", dismiss: "Skip" },
];
const ADD_IT_LATER_BUTTON = "Add it later";
const SKIP_TO_WEB_APP_LINK = "Skip to web app";
const DISMISS_TIMEOUT_MS = 15_000;

/** Dismisses the extension pitch, which otherwise stands between login and the vault. */
export async function skipExtensionSetup(page: Page) {
  if (!SETUP_EXTENSION_URL.test(page.url())) {
    return;
  }

  // With the extension installed, the page links straight to the vault. Otherwise
  // "Add it later" opens a dialog carrying that link.
  const addItLater = page.getByRole("button", { name: ADD_IT_LATER_BUTTON });
  const skip = page.getByRole("link", { name: SKIP_TO_WEB_APP_LINK });
  await expect(addItLater.or(skip).first()).toBeVisible();

  if (await addItLater.isVisible()) {
    await addItLater.click();
  }

  await skip.click();
}

/**
 * Skips onboarding modals whenever one shows up. They open asynchronously after
 * login and on navigation, so a handler beats a one-off check.
 */
export async function skipOnboardingDialogs(page: Page) {
  for (const { heading, dismiss } of ONBOARDING_DIALOGS) {
    const dialog = page.getByRole("dialog").filter({ hasText: heading });

    // A dialog can sit under another one: a second copy of itself, or e.g. desktop settings
    // opened from the app menu. A pointer click hits whatever covers its button, so dispatch
    // the click to the button itself.
    const close = dialog.getByRole("button", { name: dismiss });
    // first(): the handler's visibility check is strict, and fails on stacked copies.
    // noWaitAfter: a racing opener can show a fresh copy right after one closes (the extension
    // vault does). Waiting for the dialog to hide would stall on it; skipping the wait lets the
    // handler run again for the new copy.
    await page.addLocatorHandler(
      dialog.first(),
      async () => {
        while ((await close.count()) > 0) {
          await clickUntilDetached(close);
        }
      },
      { noWaitAfter: true },
    );
  }
}

/**
 * Clicks the first of the buttons, if any, and waits for that button to leave the DOM.
 *
 * Tracks the clicked element rather than a count: a copy reopening in its place keeps the count
 * unchanged. The dialog can also vanish on its own, e.g. torn down by locking; evaluateAll does
 * not wait for a button that is gone, unlike dispatchEvent.
 */
async function clickUntilDetached(buttons: Locator) {
  const detached = await buttons.evaluateAll(async ([button], timeoutMs) => {
    if (button == null) {
      return true;
    }

    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const deadline = Date.now() + timeoutMs;
    while (button.isConnected && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return !button.isConnected;
  }, DISMISS_TIMEOUT_MS);

  expect(detached, "Dismissing an onboarding dialog did not close it").toBe(true);
}
