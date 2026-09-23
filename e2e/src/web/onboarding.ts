import { Page } from "@playwright/test";

/** Post-login route offering the browser extension, shown until it is dismissed once. */
export const SETUP_EXTENSION_URL = /#\/setup-extension/;

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
