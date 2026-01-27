import { Page } from "playwright";
import { expect } from "playwright/test";

/**
 * Asserts that the application is unlocked as the specified user (by email or name).
 */
export async function expectUnlockedAs(emailOrName: string, page: Page) {
  const currentUri = page.url();

  // goto home
  await page.goto("/#");

  // Assert we're at the unlocked home
  await page.getByRole("button", { name: emailOrName }).click();
  await expect(page.getByRole("menu")).toContainText(`Logged in as ${emailOrName}`);

  // return to original location
  await page.goto(currentUri);
}
