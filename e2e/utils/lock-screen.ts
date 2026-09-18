import { expect, Page } from "@playwright/test";

import { VAULT_ROUTE } from "./routes";

////
// The lock screen shows one unlock method at a time, with buttons to swap
// between the methods the account has enabled.
////

export const UnlockOption = Object.freeze({
  Pin: /^unlock with pin$/i,
  MasterPassword: /^unlock with master password$/i,
} as const);
export type UnlockOption = (typeof UnlockOption)[keyof typeof UnlockOption];

const PIN_INPUT = 'input[name="pin"]';
const MASTER_PASSWORD_INPUT = 'input[name="masterPassword"]';
const UNLOCK_TEXT = /^unlock$/i;

export async function unlockWithPin(page: Page, pin: string): Promise<void> {
  await swapTo(page, UnlockOption.Pin);
  await page.locator(PIN_INPUT).fill(pin);
  await submit(page);
}

export async function unlockWithMasterPassword(page: Page, masterPassword: string): Promise<void> {
  await swapTo(page, UnlockOption.MasterPassword);
  await page.locator(MASTER_PASSWORD_INPUT).fill(masterPassword);
  await submit(page);
}

/** Whether the lock screen offers the given method, either active or behind a swap button. */
export async function offersUnlockOption(page: Page, option: UnlockOption): Promise<boolean> {
  const active = option === UnlockOption.Pin ? PIN_INPUT : MASTER_PASSWORD_INPUT;

  return (
    (await page.locator(active).isVisible()) ||
    (await page.getByRole("button", { name: option }).isVisible())
  );
}

/** The swap button is absent when the method is already the active one. */
async function swapTo(page: Page, option: UnlockOption): Promise<void> {
  const swap = page.getByRole("button", { name: option });

  if (await swap.isVisible()) {
    await swap.click();
  }
}

async function submit(page: Page): Promise<void> {
  await page.getByRole("button", { name: UNLOCK_TEXT }).click();
  await expect(page).toHaveURL(VAULT_ROUTE);
}
