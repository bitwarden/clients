import { expect, test } from "@playwright/test";

import { AttachedApp } from "../../utils/cdp";
import { readAccount } from "../../utils/credentials";
import { VAULT_ROUTE } from "../../utils/routes";
import { attachToPopup } from "../utils/app";
import { ensureLoggedIn } from "../utils/login";

const ACCOUNT_NAME = "default";

let app: AttachedApp;

test.beforeAll(async () => {
  app = await attachToPopup();
});

test.afterAll(async () => {
  await app?.detach();
});

test("logs in with master password", async () => {
  await ensureLoggedIn(app.page, readAccount(ACCOUNT_NAME));

  await expect(app.page).toHaveURL(VAULT_ROUTE);
});
