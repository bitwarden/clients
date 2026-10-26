import { BrowserContext, expect, Page } from "@playwright/test";

import { extensionShutdown, popupUrl, reachLoginPage, reopenPopup } from "../browser/fixtures";
import { enableFlags, FeatureFlag } from "../feature-flags";
import { LoginPage, logInToWebVault } from "../login";

// The popup redirects to a tab route (/tabs/vault or /tabs/current) once unlocked.
export const EXTENSION_VAULT_URL = /#\/tabs\//;
const EXTENSION_VAULT_ROUTE = "#/tabs/vault";
export const DESKTOP_VAULT_URL = /#\/vault/;
export const LOCK_URL = /#\/lock/;

/**
 * A lock or unlock reaches the other client on the next sync, at most 5 s apart, and web ↔
 * desktop relays through the extension (libs/common/src/key-management/shared-unlock).
 */
export const SYNC_TIMEOUT_MS = 30_000;

// Logged by the extension's DesktopIpcTransport once the handshake with desktop completed.
const DESKTOP_CONNECTED_LOG = "[IPC] Connected to Bitwarden Desktop App with version";
const DESKTOP_CONNECT_TIMEOUT_MS = 30_000;

/** The extension popup, and its URL to reopen it after the extension restarts. */
export type Extension = { popup: Page; url: string };

/**
 * Turns `flags` on in the extension, then logs in. The extension reloads first: it reads the IPC
 * content script flag once on start. Reloading closes `popup`.
 */
export async function logInToExtension(
  context: BrowserContext,
  popup: Page,
  flags: FeatureFlag[],
): Promise<Extension> {
  const url = await popupUrl(context);
  await enableFlags(popup, flags);

  const shutdown = extensionShutdown(context);
  // `chrome` only exists in extension pages, which the test types do not describe. The reload
  // may close the page before `evaluate` returns.
  await popup
    .evaluate(() => (globalThis as any).chrome.runtime.reload())
    .catch((): void => undefined);
  await shutdown;

  const reopened = await reopenPopup(context, url);
  await reachLoginPage(reopened);

  const login = new LoginPage(reopened);
  await login.logIn();
  await login.waitForVault(EXTENSION_VAULT_URL);

  return { popup: reopened, url };
}

/** Logs in to the web vault in a new tab. Open it after the extension started, for its content script. */
export async function logInToWeb(context: BrowserContext): Promise<Page> {
  const tab = await context.newPage();
  await logInToWebVault(tab);
  await enableFlags(tab, [FeatureFlag.SharedUnlock]);

  return tab;
}

/**
 * Back to the vault tab, e.g. from settings, where the account switcher is. Named explicitly:
 * the popup reopens on the last route it showed.
 */
export async function openExtensionVault(extension: Extension) {
  await extension.popup.goto(`${extension.url}${EXTENSION_VAULT_ROUTE}`);
  // Route transitions briefly render two pages.
  await expect(
    extension.popup.getByRole("heading", { name: "Vault", exact: true }).first(),
  ).toBeVisible();
}

/**
 * Waits for the next extension instance to reach desktop. Call before it starts, e.g. before
 * locking. Until then the extension reports desktop biometrics as DesktopDisconnected.
 */
export function desktopConnected(context: BrowserContext): () => Promise<void> {
  let connected = false;
  context.on("serviceworker", (worker) =>
    worker.on("console", (message) => {
      connected ||= message.text().includes(DESKTOP_CONNECTED_LOG);
    }),
  );

  return () =>
    expect
      .poll(() => connected, {
        timeout: DESKTOP_CONNECT_TIMEOUT_MS,
        message: "The extension never connected to desktop",
      })
      .toBe(true);
}

/**
 * Runs `lock`, which locks the extension directly or through shared unlock, and waits for the
 * extension to restart, which closes its pages. Reopens the popup on the lock screen.
 */
export async function lockExtension(
  context: BrowserContext,
  extension: Extension,
  lock: () => Promise<void>,
): Promise<Extension> {
  const shutdown = extensionShutdown(context);
  await lock();
  await shutdown;

  const popup = await reopenPopup(context, extension.url);
  await popup.waitForURL(LOCK_URL);

  return { popup, url: extension.url };
}
