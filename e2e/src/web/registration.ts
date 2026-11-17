import { expect, Page } from "@playwright/test";

import { Registrant, RegistrationPage } from "../registration";
import { Play } from "../seeder/play";
import { UserEmailVerificationQuery } from "../seeder/queries/user-email-verification.query";

import { SETUP_EXTENSION_URL, skipExtensionSetup, skipOnboardingDialogs } from "./onboarding";

/** Web lands a new account on the vault, or first on the extension pitch. */
const POST_REGISTRATION_URL = new RegExp(`#\\/vault|${SETUP_EXTENSION_URL.source}`);
const POST_REGISTRATION_TIMEOUT_MS = 60_000;

/**
 * Registers a new account through web signup and the verification email link, leaving the
 * page on the new account's vault. The play's server must track play ids to delete the account.
 */
export async function registerThroughEmailVerification(
  page: Page,
  play: Play,
  registrant: Registrant,
) {
  await skipOnboardingDialogs(page);
  const registration = new RegistrationPage(page);

  await registration.open();
  await registration.start(registrant);
  await expect(registration.checkEmailMessage).toContainText(registrant.email);

  const { url } = await play.query(
    new UserEmailVerificationQuery({ email: registrant.email, name: registrant.name }),
  );
  await page.goto(url);

  await registration.finish(registrant.password);
  await expect(page).toHaveURL(POST_REGISTRATION_URL, { timeout: POST_REGISTRATION_TIMEOUT_MS });
  await skipExtensionSetup(page);
}
