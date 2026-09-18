import { test } from "@playwright/test";

import { readAccount } from "../utils/credentials";
import { attachToDesktop, DesktopApp } from "../utils/desktop";
import { ensureLoggedIn } from "../utils/login";

const ACCOUNT_NAME = "default";

let app: DesktopApp;

test.beforeAll(async () => {
  app = await attachToDesktop();
});

test.afterAll(async () => {
  await app?.detach();
});

test("logs in with master password", async () => {
  await ensureLoggedIn(app.page, readAccount(ACCOUNT_NAME));
});
