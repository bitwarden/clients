import { randomUUID } from "node:crypto";

import { expect } from "@playwright/test";

import { clientAccounts } from "../../../src/accounts";
import { LoginPage } from "../../../src/login";
import { RegistrationPage } from "../../../src/registration";
import { test } from "../../../src/seeder/fixtures";
import { seededAccount, SingleUserScene } from "../../../src/seeder/scenes/single-user.scene";
import { WEB_VAULT_URL } from "../../../src/server";
import { logOut } from "../../../src/web/account-menu";
import { SETUP_EXTENSION_URL, skipExtensionSetup } from "../../../src/web/onboarding";
import { registerThroughEmailVerification } from "../../../src/web/registration";

const VAULT_URL = /#\/vault/;
const LOGIN_URL = /#\/login/;
const POST_LOGIN_URL = new RegExp(`${VAULT_URL.source}|${SETUP_EXTENSION_URL.source}`);
const POST_LOGIN_TIMEOUT_MS = 60_000;

test("creates an account from the verification email link", async ({ page, play }) => {
  // Given a registrant whose email has no account
  const registrant = {
    email: play.mangle("new-user@example.com"),
    name: "New User",
    password: randomUUID(),
  };

  // When they start registration, follow the emailed link and set a master password
  await registerThroughEmailVerification(page, play, registrant);

  // Then they land on their new vault, unlocked
  await expect(page).toHaveURL(VAULT_URL);
  await expect
    .poll(() => clientAccounts(page))
    .toContainEqual(expect.objectContaining({ email: registrant.email, status: "Unlocked" }));
});

test("logs in with the master password set at registration", async ({ page, play }) => {
  // Given an account created through registration, then logged out
  const registrant = {
    email: play.mangle("returning-user@example.com"),
    name: "Returning User",
    password: randomUUID(),
  };
  await registerThroughEmailVerification(page, play, registrant);
  await logOut(page);
  await expect(page).toHaveURL(LOGIN_URL);

  // When they log in with the master password they chose
  await new LoginPage(page).logIn({ ...registrant, server: WEB_VAULT_URL });
  await expect(page).toHaveURL(POST_LOGIN_URL, { timeout: POST_LOGIN_TIMEOUT_MS });
  await skipExtensionSetup(page);

  // Then their vault opens
  await expect(page).toHaveURL(VAULT_URL);
  await expect
    .poll(() => clientAccounts(page))
    .toContainEqual(expect.objectContaining({ email: registrant.email, status: "Unlocked" }));
});

test("shows the check email screen for an email that already has an account", async ({
  page,
  play,
}) => {
  // Given an existing account
  const user = await play.scene(
    new SingleUserScene({ email: "existing-user@example.com", password: randomUUID() }),
  );
  const { email } = seededAccount(user);
  const registration = new RegistrationPage(page);

  // When someone starts registration with its email
  await registration.open();
  await registration.start({ email, name: "Someone Else" });

  // Then registration answers as it does for a new email, so it does not reveal the account
  await expect(registration.checkEmailMessage).toContainText(email);
});
