import { expect, Page } from "@playwright/test";

import { Account } from "../../utils/credentials";
import { ensureLoggedIn as loginFromLoginPage } from "../../utils/login";

////
// A freshly installed extension opens on the intro carousel rather than the
// login page, so that has to be stepped past first.
////

const CAROUSEL_ROUTE = "#/intro-carousel";
const LOG_IN_TEXT = /^log in$/i;
const EMAIL_INPUT_TESTID = "login-email-input";
const CLICK_RETRY_TIMEOUT = 60_000;
const NAVIGATION_TIMEOUT = 5_000;

export async function ensureLoggedIn(page: Page, account: Account): Promise<void> {
  await dismissCarousel(page);

  await loginFromLoginPage(page, account);
}

async function dismissCarousel(page: Page): Promise<void> {
  if (!page.url().includes(CAROUSEL_ROUTE)) {
    return;
  }

  // A click that lands while the popup is still starting up is swallowed, and an
  // intro-carousel guard sends direct navigation straight back here, so retry it.
  await expect(async () => {
    await page.getByRole("button", { name: LOG_IN_TEXT }).click();
    await expect(page.getByTestId(EMAIL_INPUT_TESTID)).toBeVisible({
      timeout: NAVIGATION_TIMEOUT,
    });
  }).toPass({ timeout: CLICK_RETRY_TIMEOUT });
}
