import { expect, test } from "@playwright/test";

import { readAccount } from "../../utils/credentials";
import { loginViaSso } from "../utils/sso";

////
// The org behind these credentials is configured for SSO with trusted device
// encryption, so its members have no master password at all. A member's first
// SSO login provisions their keys and trusts the browser; from any other
// browser the same login has to be approved, and no master password is offered
// as a way around that.
////

const ORG_ACCOUNT_NAME = "local-tde-admin";
const IDP_USER = { email: "user1@example.com", username: "user1", password: "password" };

const LOGIN_INITIATED_ROUTE = /#\/login-initiated/;
const REMEMBER_DEVICE_CHECKBOX = 'input[formcontrolname="rememberDevice"]';
const APPROVE_FROM_DEVICE_TEXT = /approve from your other device/i;
const ADMIN_APPROVAL_TEXT = /request admin approval/i;
const MASTER_PASSWORD_TEXT = /master password/i;

test("logs in with SSO and requires device approval, not a master password", async ({ page }) => {
  const org = readAccount(ORG_ACCOUNT_NAME);

  await loginViaSso(page, org.ssoIdentifier!, IDP_USER);

  await expect(page).toHaveURL(LOGIN_INITIATED_ROUTE);
  await expect(page.locator(REMEMBER_DEVICE_CHECKBOX)).toBeChecked();

  // This browser is a device the account has never trusted, so decryption has
  // to come from an approval.
  await expect(page.getByRole("button", { name: APPROVE_FROM_DEVICE_TEXT })).toBeVisible();
  await expect(page.getByRole("button", { name: ADMIN_APPROVAL_TEXT })).toBeVisible();

  // A trusted-device member has no master password to fall back on.
  await expect(page.getByText(MASTER_PASSWORD_TEXT)).toHaveCount(0);
});
