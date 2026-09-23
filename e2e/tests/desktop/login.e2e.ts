import { AccountName, account } from "../../src/credentials";
import { expect, test } from "../../src/desktop/fixtures";
import { LoginPage, ServerChoice } from "../../src/login";

const VAULT_URL = /#\/vault/;

test("logs into the vault with a master password", async ({ window }) => {
  const login = new LoginPage(window);
  await login.logIn(account(AccountName.Usdev), ServerChoice.Selectable);
  await login.waitForVault(VAULT_URL);

  await expect(window.getByTestId("login-master-password-input")).toBeHidden();
});
