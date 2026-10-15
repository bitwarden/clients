import { test } from "../../../src/browser/fixtures";
import { LoginPage } from "../../../src/login";

// The popup redirects to a tab route (/tabs/vault or /tabs/current) once unlocked.
const VAULT_URL = /#\/tabs\//;

test("logs into the vault with a master password", async ({ popup }) => {
  // Given the user is on the login page
  const login = new LoginPage(popup);

  // When the user logs in with a master password
  await login.logIn();

  // Then the user should be redirected to the vault page
  await login.waitForVault(VAULT_URL);
});
