import { Page } from "@playwright/test";

////
// Points the app at a server before logging in. Regions are picked from the
// environment selector menu; anything else goes through the self-hosted dialog.
////

const REGION_MENU_TRIGGER = 'button[aria-haspopup="menu"]';
const SELF_HOSTED_MENU_ITEM = /self-hosted/i;
const BASE_URL_INPUT = "#self_hosted_env_settings_form_input_base_url";
const SAVE_BUTTON = /^save$/i;

const REGION_DOMAINS = ["bitwarden.com", "bitwarden.eu"];

/**
 * Selects `server` in the environment selector on the login page. `server` is a
 * bare domain or URL, e.g. "bitwarden.eu" or "vault.usdev.bitwarden.pw".
 */
export async function selectServer(page: Page, server: string): Promise<void> {
  const trigger = page.locator(REGION_MENU_TRIGGER).first();
  await trigger.click();

  if (isRegion(server)) {
    await page.getByRole("menuitem", { name: server }).click();
    return;
  }

  await page.getByRole("menuitem", { name: SELF_HOSTED_MENU_ITEM }).click();
  await page.locator(BASE_URL_INPUT).fill(toBaseUrl(server));
  await page.getByRole("button", { name: SAVE_BUTTON }).click();
}

function isRegion(server: string): boolean {
  return REGION_DOMAINS.includes(server.replace(/^https?:\/\//, "").replace(/\/$/, ""));
}

function toBaseUrl(server: string): string {
  return server.startsWith("http") ? server : `https://${server}`;
}
