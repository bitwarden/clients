import {
  expectUnlockedAs,
  Play,
  SingleUserSceneTemplate,
  test,
} from "@bitwarden/playwright-helpers";

test("login with password", async ({ page }) => {
  const scene = await Play.scene(new SingleUserSceneTemplate({ email: "test@example.com" }));

  await page.goto("/#/login");
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
  await page.getByRole("button", { name: "Continue without upgrading" }).click();

  // assert our user is logged in
  await expectUnlockedAs(scene.mangle("test@example.com"), page);
});
