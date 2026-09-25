import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { ElectronApplication, Page, chromium } from "@playwright/test";

import { AccountName, account } from "../../src/credentials";
import { clickMenuItem, MenuItem } from "../../src/desktop/app-menu";
import { expect, test } from "../../src/desktop/fixtures";
import { LoginPage, ServerChoice } from "../../src/login";
import { E2E_STATE_DIR } from "../../src/paths";
import { reportLockCycles } from "../../src/perf";

/**
 * Measures lock and master password unlock on desktop.
 *
 *   login ──► [ lock ──► lock screen ──► unlock ──► vault ] × ITERATIONS
 *
 * Wall-clock timings come from the test; `[perf]` lines the app logs (the
 * renderer forwards its logs to the main process stdout) are collected alongside.
 * Results land in .debug/e2e/perf/<PERF_LABEL>.json.
 */

const VAULT_URL = /#\/vault/;
const LOCK_URL = /#\/lock/;
const PERF_TAG = "[perf]";

const ITERATIONS = Number(process.env.PERF_ITERATIONS ?? 3);
const LABEL = process.env.PERF_LABEL ?? "run";
const PERF_DIR = resolve(E2E_STATE_DIR, "perf");
/** Records a renderer CPU profile of this iteration's unlock, e.g. `PERF_PROFILE=1`. */
const PROFILE_ITERATION =
  process.env.PERF_PROFILE != null ? Number(process.env.PERF_PROFILE) : null;
/** Post-unlock work (background sync, re-decrypts) settles within this; keeps it out of the next lock. */
const SETTLE_MS = 6_000;

/** First rendered vault row's checkbox; the vault is usable from here. */
const firstVaultRow = (window: Page) =>
  window.getByRole("checkbox", { name: "Select row", exact: true }).first();

/** Error text can carry URLs with access tokens, e.g. the notifications hub. */
const redact = (text: string) => text.replace(/access_token=[^&\s']+/g, "access_token=<redacted>");

type Iteration = { lockMs: number; unlockMs: number; vaultRowsMs: number };

const PASSWORD_INPUT = 'input[name="masterPassword"]';
const POLL_MS = 50;
/** Logging into a large vault syncs and decrypts every item before the vault shows. */
const VAULT_TIMEOUT_MS = 300_000;
const LOCK_TIMEOUT_MS = 60_000;

/** Lets the test re-attach after lock crashes the renderer; Playwright pages never recover from a crash. */
const CDP_PORT = 9333;
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;
const STALE_TAG = "__e2eStaleRenderer";
/** Development builds skip the lock-time reload (see window.main.ts), so the old renderer stays. */
const NO_RELOAD = process.env.PERF_NO_RELOAD != null;

/**
 * Lock crashes and reloads the renderer (see window.main.ts "reload-process").
 * Reconnects over CDP until the fresh (untagged) renderer shows the lock screen.
 */
async function isFreshLockScreen(page: Page): Promise<boolean> {
  if (!LOCK_URL.test(page.url())) {
    return false;
  }

  const fresh =
    NO_RELOAD || (await page.evaluate((tag) => !(tag in window), STALE_TAG).catch(() => false));
  if (!fresh) {
    return false;
  }

  return page
    .locator(PASSWORD_INPUT)
    .isVisible()
    .catch(() => false);
}

async function lockScreen(): Promise<Page> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const browser = await chromium.connectOverCDP(CDP_URL);

    // Other targets, e.g. DevTools in development builds, can come first.
    for (const page of browser.contexts().flatMap((c) => c.pages())) {
      if (await isFreshLockScreen(page)) {
        return page;
      }
    }

    await browser.close();
    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  throw new Error("Lock screen never appeared");
}

async function lock(
  app: ElectronApplication,
  current: Page,
): Promise<{ ms: number; window: Page }> {
  // The old renderer briefly shows the lock screen too; the tag tells it apart from the reloaded one.
  await current.evaluate((tag) => ((window as any)[tag] = true), STALE_TAG);

  const start = Date.now();
  await clickMenuItem(app, MenuItem.LockAll);
  const window = await lockScreen();
  const ms = Date.now() - start;

  // Drop the previous CDP connection; the Electron fixture's own page has no browser to close.
  await current.context().browser()?.close();

  return { ms, window };
}

/** Samples the renderer's CPU; open the .cpuprofile in Chrome DevTools > Performance. */
async function startProfiler(window: Page) {
  const cdp = await window.context().newCDPSession(window);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
  await cdp.send("Profiler.start");

  return {
    stop: async () => {
      const { profile } = await cdp.send("Profiler.stop");
      mkdirSync(PERF_DIR, { recursive: true });
      writeFileSync(resolve(PERF_DIR, `${LABEL}-unlock.cpuprofile`), JSON.stringify(profile));
    },
  };
}

async function unlock(
  window: Page,
  password: string,
): Promise<{ unlockMs: number; vaultRowsMs: number }> {
  await window.locator(PASSWORD_INPUT).fill(password);

  const start = Date.now();
  await window.getByRole("button", { name: "Unlock", exact: true }).click();

  await window.waitForURL(VAULT_URL, { timeout: 60_000 });
  await expect(window.locator(PASSWORD_INPUT)).toBeHidden();
  const unlockMs = Date.now() - start;

  await expect(firstVaultRow(window)).toBeVisible({ timeout: VAULT_TIMEOUT_MS });

  return { unlockMs, vaultRowsMs: Date.now() - start };
}

// Tracing can't follow the renderer across the lock-time crash, and fails the test on teardown.
test.use({ extraArgs: [`--remote-debugging-port=${CDP_PORT}`], trace: "off" });

test("measures lock and master password unlock", async ({ app, window }) => {
  test.setTimeout(1_200_000);

  // Renderer logs are forwarded to the main process, so its stdout carries both.
  const logs: string[] = [];
  app.process().stdout?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.includes(PERF_TAG)) {
        logs.push(line.trim());
      }
    }
  });

  // Surface renderer errors; a failed step otherwise only shows up as a timeout.
  window.on("console", (msg) => {
    if (msg.type() === "error") {
      // eslint-disable-next-line no-console
      console.log(`renderer error: ${redact(msg.text())}`);
      for (const arg of msg.args()) {
        void arg
          .evaluate((e) => (e instanceof Error ? e.stack : null))
          // eslint-disable-next-line no-console
          .then((stack) => stack && console.log(`renderer stack: ${redact(stack)}`))
          .catch(() => {});
      }
    }
  });
  // eslint-disable-next-line no-console
  window.on("pageerror", (e) => console.log(`pageerror: ${e.stack}`));

  const target = account(AccountName.Usdev);
  const login = new LoginPage(window);
  await login.logIn(target, ServerChoice.Selectable);
  await window.waitForURL(VAULT_URL, { timeout: VAULT_TIMEOUT_MS });

  // Let post-login work (sync, decrypt) settle so it doesn't skew the first lock.
  await expect(firstVaultRow(window)).toBeVisible({ timeout: VAULT_TIMEOUT_MS });
  await window.waitForTimeout(5_000);
  logs.push("---- login done ----");

  const iterations: Iteration[] = [];
  let current = window;
  for (let i = 0; i < ITERATIONS; i++) {
    logs.push(`---- t=${Date.now()} iteration ${i} lock ----`);
    const locked = await lock(app, current);
    current = locked.window;

    logs.push(`---- t=${Date.now()} iteration ${i} unlock ----`);
    const profiler = i === PROFILE_ITERATION ? await startProfiler(locked.window) : null;
    const unlocked = await unlock(locked.window, target.password);
    await profiler?.stop();

    iterations.push({ lockMs: locked.ms, ...unlocked });
    await locked.window.waitForTimeout(SETTLE_MS);
  }

  await current.context().browser()?.close();

  mkdirSync(PERF_DIR, { recursive: true });
  const out = resolve(PERF_DIR, `${LABEL}.json`);
  writeFileSync(out, JSON.stringify({ label: LABEL, iterations, logs }, null, 2));

  // eslint-disable-next-line no-console
  console.log(`${PERF_TAG} app timings → ${out}`);
  // Unlock counts until the first vault row shows, as on the other clients' vault route.
  reportLockCycles(
    "desktop",
    iterations.map((i) => ({ lockMs: i.lockMs, unlockMs: i.vaultRowsMs })),
  );
});
