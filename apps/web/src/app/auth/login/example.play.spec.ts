import { expect } from "@playwright/test";

import { Play, SingleUserSceneTemplate, test } from "@bitwarden/playwright-helpers";

test("login with password", async ({ page }) => {
  const scene = await Play.scene(new SingleUserSceneTemplate({ email: "test@example.com" }));

  await page.goto("https://localhost:8080/#/login");
  await page.getByRole("textbox", { name: "Email address (required)" }).click();
  await page
    .getByRole("textbox", { name: "Email address (required)" })
    .fill(scene.mangle("test@example.com"));
  await page.getByRole("textbox", { name: "Email address (required)" }).press("Enter");
  await page.getByRole("textbox", { name: "Master password (required)" }).click();
  await page
    .getByRole("textbox", { name: "Master password (required)" })
    .fill(scene.mangle("asdfasdfasdf"));
  await page.getByRole("button", { name: "Log in with master password" }).click();

  await page.getByRole("button", { name: "Add it later" }).click();
  await page.getByRole("link", { name: "Skip to web app" }).click();
});

test("login and save session", async ({ auth }) => {
  const { page, scene } = await auth.authenticate("test@example.com", "asdfasdfasdf");

  await page.goto("/#");

  await page.getByRole("button", { name: scene.mangle("test@example.com") }).click();
  await expect(page.getByRole("menu")).toContainText(
    `Logged in as ${scene.mangle("test@example.com")}`,
  );
});

test("As long as the previous test ran in this worker, this time it will reuse authentication", async ({
  auth,
}) => {
  const { page, scene } = await auth.authenticate("test@example.com", "asdfasdfasdf");

  await page.goto("/#");

  await page.getByRole("button", { name: scene.mangle("test@example.com") }).click();
  await expect(page.getByRole("menu")).toContainText(
    `Logged in as ${scene.mangle("test@example.com")}`,
  );
});
