import { expect, test } from "@playwright/test";

import { readAccount } from "../../utils/credentials";
import { VAULT_ROUTE } from "../../utils/routes";
import { ensureLoggedIn } from "../utils/login";

// The dev server talks to the local server stack, so the account must exist there.
const ACCOUNT_NAME = "local";

test("logs in with master password", async ({ page }) => {
  await page.goto("/");

  await ensureLoggedIn(page, readAccount(ACCOUNT_NAME));

  await expect(page).toHaveURL(VAULT_ROUTE);
});
