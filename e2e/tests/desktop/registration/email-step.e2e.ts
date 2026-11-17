import { randomUUID } from "node:crypto";

import { expect, test } from "../../../src/desktop/fixtures";
import { LoginPage } from "../../../src/login";
import { RegistrationPage } from "../../../src/registration";
import { WEB_VAULT_URL } from "../../../src/server";

test("sends the verification email through the self-hosted server", async ({ window }) => {
  // Given desktop points at the self-hosted server
  const login = new LoginPage(window);
  await login.selectServer(WEB_VAULT_URL);

  // When a registrant submits the email step of signup
  await login.createAccount();
  const registration = new RegistrationPage(window);
  const email = `signup-${randomUUID()}@example.com`;
  const response = await registration.start({ email, name: "New User" });

  // Then that server accepts it, and desktop asks the registrant to check their email
  expect(new URL(response.url()).origin).toBe(new URL(WEB_VAULT_URL).origin);
  expect(response.ok()).toBe(true);
  await expect(registration.checkEmailMessage).toContainText(email);
});
