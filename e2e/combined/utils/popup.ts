import { expect, Page } from "@playwright/test";

import { Popup } from "./bdd";

////
// Waiting on the extension popup, which closes and reopens around locking: the
// page a check ran against can be gone by the time it answers, so the page is
// re-resolved on every attempt and a dead page counts as "not yet".
////

/**
 * The first native messaging round trip also spawns the proxy, and the lock screen
 * waits on the desktop app's answer, so these checks outlast the default timeout.
 */
const IPC_HANDSHAKE_TIMEOUT = 90_000;

const BROWSER_CDP_PORT = 9200;

export async function waitForPopup(
  popup: Popup,
  check: (page: Page) => Promise<boolean>,
): Promise<void> {
  try {
    await expect
      .poll(
        async () => {
          try {
            return await check(await popup());
          } catch {
            return false;
          }
        },
        { timeout: IPC_HANDSHAKE_TIMEOUT },
      )
      .toBe(true);
  } catch (error) {
    // What the popup is showing instead is the whole story, and it is gone by the
    // time anyone opens the trace.
    throw new Error(`${(error as Error).message}\n\nPopup state:\n${await describePopup(popup)}`);
  }
}

async function describePopup(popup: Popup): Promise<string> {
  const lines: string[] = [];

  try {
    const response = await fetch(`http://127.0.0.1:${BROWSER_CDP_PORT}/json/list`);
    const targets: { type: string; url: string }[] = await response.json();

    lines.push(...targets.map((target) => `  target ${target.type} ${target.url}`));
  } catch (error) {
    lines.push(`  no target list: ${(error as Error).message}`);
  }

  try {
    const page = await popup();
    const text = await page.locator("body").innerText();

    lines.push(`  url ${page.url()}`, `  text ${text.replace(/\s+/g, " ").slice(0, 400)}`);
  } catch (error) {
    lines.push(`  no live popup: ${(error as Error).message}`);
  }

  return lines.join("\n");
}
