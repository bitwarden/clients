import { Page } from "@playwright/test";

/** Post-login route offering the browser extension, shown until it is dismissed once. */
export const SETUP_EXTENSION_URL = /#\/setup-extension/;

/** Onboarding modals that pop up over the vault after login, each dismissed with "Skip". */
const ONBOARDING_DIALOGS = [
  "You're in! Welcome to Bitwarden",
  "Get the extension for easy vault access",
];
const ADD_IT_LATER_BUTTON = "Add it later";
const SKIP_TO_WEB_APP_LINK = "Skip to web app";

/** Dismisses the extension pitch, which otherwise stands between login and the vault. */
export async function skipExtensionSetup(page: Page) {
  if (!SETUP_EXTENSION_URL.test(page.url())) {
    return;
  }

  await page.getByRole("button", { name: ADD_IT_LATER_BUTTON }).click();
  await page.getByRole("link", { name: SKIP_TO_WEB_APP_LINK }).click();
}

/**
 * Skips onboarding modals whenever one shows up. They open asynchronously after
 * login and on navigation, so a handler beats a one-off check.
 */
export async function skipOnboardingDialogs(page: Page) {
  for (const heading of ONBOARDING_DIALOGS) {
    const dialog = page.getByRole("dialog").filter({ hasText: heading });

    await page.addLocatorHandler(dialog, async () => {
      await dialog.getByRole("button", { name: "Skip" }).click();
    });
  }
}
