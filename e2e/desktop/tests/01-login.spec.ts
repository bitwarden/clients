import { expect, test } from "@playwright/test";

import { AttachedApp } from "../../utils/cdp";
import { readAccount } from "../../utils/credentials";
import { ensureLoggedIn } from "../../utils/login";
import { VAULT_ROUTE } from "../../utils/routes";
import { attachToDesktop } from "../utils/app";

const ACCOUNT_NAME = "default";

let app: AttachedApp;

test.beforeAll(async () => {
  app = await attachToDesktop();
});

test.afterAll(async () => {
  await app?.detach();
});

test("logs in with master password", async () => {
  await ensureLoggedIn(app.page, readAccount(ACCOUNT_NAME));

  await expect(app.page).toHaveURL(VAULT_ROUTE);
});
