import { Page } from "@playwright/test";

// libs/vault new-experience-dialog. Its nudge lives in client state, so every fresh e2e profile
// gets it, unless the server suppresses onboarding interstitials, as the local dev server does.
const NEW_LOOK_HEADING = "Bitwarden has a new look";
const NEW_LOOK_CLOSE = "Close";
// The vault page opens it a few seconds after it loads, once flags and nudges resolve.
const NEW_LOOK_TIMEOUT_MS = 10_000;

/**
 * Closes the "new look" dialog, if it opens, right after login. Left to open later, it lands on
 * top of or under whatever dialog the test has open, e.g. settings or an approval prompt.
 */
export async function dismissNewLookDialog(window: Page) {
  const dialog = window.getByRole("dialog").filter({ hasText: NEW_LOOK_HEADING });

  const opened = await dialog
    .waitFor({ timeout: NEW_LOOK_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);
  if (!opened) {
    return;
  }

  await dialog.getByRole("button", { name: NEW_LOOK_CLOSE }).click();
  await dialog.waitFor({ state: "hidden" });
}
