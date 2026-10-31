import { expect, Page } from "@playwright/test";

/** Announcement modals any client may open over the vault, e.g. after a redesign. */
const ANNOUNCEMENT_DIALOGS = ["Bitwarden has a new look"];
const APPEAR_TIMEOUT_MS = 15_000;

/**
 * Waits briefly for an announcement after login and closes it. Closing stores the
 * dismissal, so nothing opens later, e.g. in the middle of a measurement.
 */
export async function dismissAnnouncement(page: Page) {
  const dialog = page
    .getByRole("dialog")
    .filter({ hasText: new RegExp(ANNOUNCEMENT_DIALOGS.join("|")) });

  const shown = await dialog.waitFor({ timeout: APPEAR_TIMEOUT_MS }).then(
    () => true,
    () => false,
  );
  if (!shown) {
    return;
  }

  // Closing stores the dismissal first, so the dialog stays away after the next unlock.
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
}
