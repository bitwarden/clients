import { test } from "../../../src/desktop/fixtures";
import { LoginPage } from "../../../src/login";

const VAULT_URL = /#\/vault/;

test("logs into the vault with a master password", async ({ window }) => {
  // Given the user is on the login page
  const login = new LoginPage(window);

  // When the user logs in with a master password
  await login.logIn();

  // Then the user should be redirected to the vault page
  await login.waitForVault(VAULT_URL);
});
