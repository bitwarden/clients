import { browser } from "@wdio/globals";

import { getExtension } from "./install-extension";

/**
 * Navigates to a popup route and waits for the Angular app to render past its initial loading
 * spinner. A freshly installed extension's MV3 background service worker cold-starts on first
 * access and can take a while to answer the popup's init messaging; the popup must not be reloaded
 * during that window (a reload interrupts the handshake and restarts the wait), so this issues a
 * single navigation and then waits patiently.
 */
export async function openPopup(
  route: string,
  isRendered: () => Promise<boolean>,
  timeoutMs = 90000,
): Promise<void> {
  await browser.url(getExtension().popupUrl(route));
  await browser.waitUntil(isRendered, {
    timeout: timeoutMs,
    interval: 500,
    timeoutMsg: `Popup did not render "${route}" within ${timeoutMs}ms`,
  });
}
