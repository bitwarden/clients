import { expect, Page } from "@playwright/test";

/**
 * Runs `open`, then accepts the confirmation it opens, which may sit on top of another dialog
 * such as an open item. The confirmation is the component library's simple dialog, which carries
 * no test ids; its accept button is its first, the one it focuses on open.
 */
export async function confirmSimpleDialog(page: Page, open: () => Promise<void>) {
  const dialogs = page.getByRole("dialog");
  const before = await dialogs.count();

  await open();
  await expect(dialogs).toHaveCount(before + 1);
  await dialogs.nth(before).getByRole("button").first().click();
  await expect(dialogs).toHaveCount(before);
}
