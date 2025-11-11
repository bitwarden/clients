import { expect } from "@playwright/test";

import { Play, test } from "@bitwarden/playwright-helpers";

test.only("test", async ({ page }) => {
  await page.goto("https://localhost:8080/#/signup");

  await page
    .getByRole("textbox", { name: "Email address (required)" })
    .fill(Play.mangleEmail("create@test.com"));
  await page.getByRole("textbox", { name: "Name" }).fill("John Doe");
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .getByRole("textbox", { name: "Master password (required)", exact: true })
    .fill("asdfasdfasdf");
  await page.getByRole("textbox", { name: "Confirm master password (" }).fill("asdfasdfasdf");

  await page.getByRole("textbox", { name: "Master password hint" }).fill("asdfasdfasdf");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("#bit-error-0")).toContainText(
    "Your password hint cannot be the same as your password.",
  );
  await page
    .getByRole("textbox", { name: "Master password hint" })
    .fill("the hint for the password");

  await page.getByRole("checkbox", { name: "Check known data breaches for" }).uncheck();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("#bit-dialog-title-0")).toContainText(
    "Weak password identified. Use a strong password to protect your account. Are you sure you want to use a weak password?",
  );
  await page.getByRole("button", { name: "Yes" }).click();
  await page.getByRole("button", { name: "Add it later" }).click();
  await page.getByRole("link", { name: "Skip to web app" }).click();
});
