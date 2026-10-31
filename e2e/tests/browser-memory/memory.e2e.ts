import { BrowserContext, Page, expect } from "@playwright/test";

import { popupUrl, reachLoginPage } from "../../src/browser/fixtures";
import { decryptCallSummary, recordDecryptCalls } from "../../src/browser/memory/decrypt-calls";
import { test } from "../../src/browser/memory/fixtures";
import {
  countDecryptedPasswords,
  extensionPids,
  findTargets,
  kindOf,
  waitForStableHeap,
} from "../../src/browser/memory/probe";
import { MemoryReport } from "../../src/browser/memory/report";
import { TestSite } from "../../src/browser/memory/test-site";
import { vaultCacheState } from "../../src/browser/memory/vault-cache";
import { disableFlags, FeatureFlag } from "../../src/feature-flags";
import { LoginPage } from "../../src/login";

const VAULT_URL = /#\/tabs\//;
const FRAMES_PER_PAGE = 4;
// Content scripts inject on load, then the page reports its fields to the background.
const INJECTION_SETTLE_MS = 5_000;
const INLINE_MENU_SETTLE_MS = 3_000;
const AUTOFILLS = 5;
const POPUP_REOPENS = 3;
const FILL_COMMAND = "fillCipherForPopup";
// CipherType.Login (libs/common/src/vault/enums/cipher-type.ts).
const CipherType = Object.freeze({ Login: 1 } as const);

async function serviceWorker(port: number) {
  const targets = await findTargets(port);
  const worker = targets.find((t) => kindOf(t) === "service_worker");

  if (worker == null) {
    throw new Error("The extension's service worker is not running.");
  }

  return worker;
}

/** Every extension context, settled. */
async function extensionTargets(port: number) {
  await waitForStableHeap(await serviceWorker(port));
  return findTargets(port);
}

/**
 * What the service worker holds of the decrypted vault, and the decrypts it ran since
 * the last call: these start counting over.
 */
async function vaultFindings(port: number) {
  const worker = await serviceWorker(port);
  const findings = {
    decryptCalls: await decryptCallSummary(worker),
    decryptedCipherCache: await vaultCacheState(worker),
    plaintextPasswordsInHeap: await countDecryptedPasswords(worker),
  };
  await recordDecryptCalls(worker);

  return findings;
}

/** Id of some login in the vault, read from the encrypted state in `chrome.storage.local`. */
async function anyCipherId(popup: Page): Promise<string> {
  return popup.evaluate(async (LOGIN_TYPE) => {
    // Runs in the extension page, where `chrome` is the extension API.
    const chrome = (globalThis as any).chrome;
    const local = await chrome.storage.local.get(null);
    const ciphers = Object.entries(local).find(([key]) => key.endsWith("_ciphers_ciphers"));
    // Large values are stored as JSON text: `{ __json__: true, value: "{...}" }`.
    const stored = ciphers![1] as { __json__?: boolean; value?: string };
    const record = stored.__json__ ? JSON.parse(stored.value!) : stored;
    const login = Object.values(record as Record<string, { id: string; type: number }>).find(
      (cipher) => cipher.type === LOGIN_TYPE,
    );
    return login!.id;
  }, CipherType.Login);
}

/**
 * Fills `cipherId` into the tab at `url` as the popup's Fill button does, which also
 * writes the cipher's last used date. The seeded vault's logins have no URIs, so the
 * inline menu, which only lists matches, has nothing to fill.
 */
async function fillFromPopup(popup: Page, url: string, cipherId: string) {
  await popup.evaluate(
    async ({ url, cipherId, command }) => {
      const chrome = (globalThis as any).chrome;
      const [tab] = await chrome.tabs.query({ url });
      // Not awaited: the response can go missing; the filled page is what tells.
      void chrome.runtime.sendMessage({
        command,
        tabId: tab.id,
        tabUrl: tab.url,
        cipherId,
      });
    },
    { url, cipherId, command: FILL_COMMAND },
  );
}

async function closeExtensionPages(context: BrowserContext) {
  for (const page of context.pages()) {
    if (page.url().startsWith("chrome-extension://")) {
      await page.close();
    }
  }
}

/**
 * Walks the extension through its lifecycle and records the heap of every context at
 * each step. Results land in `.debug/e2e/memory/<E2E_MEMORY_LABEL>/report.json`.
 *
 *   logged out ─▶ popup on vault ─▶ unlocked, popup closed ─▶ pages open ─▶ inline menu
 *     ─▶ autofill 5 times ─▶ service worker restarted in a fresh process ─▶ popup reopened 3 times
 *
 * Locked is left out: locking restarts the extension, which is the logged out state again.
 */
test("measures memory across the extension lifecycle", async ({ context, debuggingPort }) => {
  test.setTimeout(600_000);
  const report = new MemoryReport(debuggingPort);
  const site = await TestSite.start();

  // Fresh install, nobody logged in.
  const url = await popupUrl(context);
  await closeExtensionPages(context);
  await report.record("logged_out_idle", await extensionTargets(debuggingPort));
  await recordDecryptCalls(await serviceWorker(debuggingPort));

  // Log in and let the vault sync and decrypt.
  const popup = await context.newPage();
  await popup.goto(url);
  await reachLoginPage(popup);
  await disableFlags(popup, [FeatureFlag.PasswordPreloginFromSdk]);
  const login = new LoginPage(popup);
  await login.logIn();
  await login.waitForVault(VAULT_URL);
  await waitForStableHeap((await findTargets(debuggingPort)).find((t) => kindOf(t) === "popup")!);
  await report.record("popup_vault", await extensionTargets(debuggingPort));

  // The popup is closed most of the time; the background stays.
  await popup.close();
  await report.record(
    "unlocked_idle",
    await extensionTargets(debuggingPort),
    await vaultFindings(debuggingPort),
  );

  // Content scripts: the same page with and without them, each with iframes.
  const baseline = await context.newPage();
  await baseline.goto(site.baselineUrl(FRAMES_PER_PAGE));
  const page = await context.newPage();
  await page.goto(site.loginUrl(FRAMES_PER_PAGE));
  await page.waitForTimeout(INJECTION_SETTLE_MS);
  const pages = /\/login\?frames=/;
  await report.record("pages_open", await findTargets(debuggingPort, pages));

  // Focusing a field opens the inline menu, an extension iframe of its own.
  await page.locator("#username").click();
  await page.waitForTimeout(INLINE_MENU_SETTLE_MS);
  await report.record("inline_menu_open", await findTargets(debuggingPort, pages));
  await baseline.close();
  await page.close();
  await recordDecryptCalls(await serviceWorker(debuggingPort));

  // Each fill writes the cipher's last used date.
  const target = await context.newPage();
  await target.goto(site.loginUrl(0));
  await target.waitForTimeout(INJECTION_SETTLE_MS);
  const filler = await context.newPage();
  await filler.goto(url);
  const cipherId = await anyCipherId(filler);
  for (let i = 0; i < AUTOFILLS; i++) {
    await target.locator("#password").fill("");
    // A fill message can go missing; sending it again is harmless.
    await expect(async () => {
      await fillFromPopup(filler, target.url(), cipherId);
      await expect(target.locator("#password")).not.toHaveValue("", { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
  }
  await filler.close();
  await report.record(
    "autofill_x5",
    await extensionTargets(debuggingPort),
    await vaultFindings(debuggingPort),
  );
  await target.close();

  // Chrome stops an idle service worker and later starts it in a fresh process, still
  // unlocked. Killing the process does the same now, separating what is in use from what
  // the old process accumulated.
  for (const pid of extensionPids()) {
    process.kill(pid, "SIGKILL");
  }
  const waker = await context.newPage();
  await waker.goto(site.loginUrl(0));
  await expect
    .poll(
      async () => (await findTargets(debuggingPort)).some((t) => kindOf(t) === "service_worker"),
      { timeout: 60_000 },
    )
    .toBe(true);
  await waker.close();
  await recordDecryptCalls(await serviceWorker(debuggingPort));
  await report.record(
    "sw_restarted",
    await extensionTargets(debuggingPort),
    await vaultFindings(debuggingPort),
  );

  // Each popup open builds a whole Angular app and its own list views in the shared
  // process; growth across opens would be a leak rather than one-time fragmentation.
  for (let i = 0; i < POPUP_REOPENS; i++) {
    const reopened = await context.newPage();
    await reopened.goto(url);
    await reopened.waitForURL(VAULT_URL);
    await waitForStableHeap((await findTargets(debuggingPort)).find((t) => kindOf(t) === "popup")!);
    await reopened.close();
    await report.record(`popup_reopened_${i + 1}`, await extensionTargets(debuggingPort));
  }

  report.write();
  await site.stop();
});
