import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

import { BrowserContext, Page, chromium, expect, test as base } from "@playwright/test";

import { BROWSER_BUILD_DIR, E2E_STATE_DIR } from "../paths";

const PROFILE_DIR = resolve(E2E_STATE_DIR, "chrome-profile");
const EXTENSION_SCHEME = "chrome-extension://";
const SERVICE_WORKER_TIMEOUT_MS = 30_000;
const ONBOARDING_TIMEOUT_MS = 60_000;
const EXTENSIONS_PAGE = "chrome://extensions";
const DEVELOPER_MODE_TOGGLE = "#devMode";
const SKIP_DEFAULT_MANAGER_BUTTON = "#default-password-manager-prompt_button_skip-for-now";

/**
 * Extensions load only into a persistent context. Chromium's new headless mode does
 * register the service worker, but the popup never bootstraps past its loading
 * spinner there, so this suite is always headed and ignores `--headed`.
 */
/**
 * Lock restarts the extension (chrome.runtime.reload), and Chromium turns a reloaded
 * unpacked extension off unless developer mode is on. Chromium rewrites its preferences
 * on start, so flip the toggle like a developer would.
 */
async function enableDeveloperMode(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto(EXTENSIONS_PAGE);

  // Playwright's CSS engine pierces the page's open shadow roots.
  const toggle = page.locator(DEVELOPER_MODE_TOGGLE);
  if ((await toggle.getAttribute("aria-pressed")) !== "true") {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await page.close();
}

async function launch(baseURL: string | undefined): Promise<BrowserContext> {
  rmSync(PROFILE_DIR, { recursive: true, force: true });

  return chromium.launchPersistentContext(PROFILE_DIR, {
    channel: "chromium",
    headless: false,
    // The local dev server serves a self-signed certificate.
    ignoreHTTPSErrors: true,
    // Lets suites that also drive the web vault use relative URLs in this context.
    baseURL,
    args: [
      `--load-extension=${BROWSER_BUILD_DIR}`,
      `--disable-extensions-except=${BROWSER_BUILD_DIR}`,
    ],
  });
}

/** The id is assigned at load time, and only observable once the worker registers. */
async function extensionId(context: BrowserContext): Promise<string> {
  const worker =
    context.serviceWorkers().find((w) => w.url().startsWith(EXTENSION_SCHEME)) ??
    (await context.waitForEvent("serviceworker", { timeout: SERVICE_WORKER_TIMEOUT_MS }));

  return new URL(worker.url()).hostname;
}

function popupPath(): string {
  const manifest = JSON.parse(readFileSync(join(BROWSER_BUILD_DIR, "manifest.json"), "utf8"));
  const popup = manifest.action?.default_popup;

  if (popup == null) {
    throw new Error("The extension manifest declares no action popup.");
  }

  return popup;
}

/** URL of the extension popup, which Playwright can open as a full page. */
export async function popupUrl(context: BrowserContext): Promise<string> {
  return `${EXTENSION_SCHEME}${await extensionId(context)}/${popupPath()}`;
}

const REOPEN_TIMEOUT_MS = 30_000;
const REOPEN_RETRY_MS = 100;

/**
 * Resolves once the running extension instance shut down, which lock does to wipe it from
 * memory (BrowserProcessReloadService). Call before locking. The next instance starts
 * lazily, e.g. when the popup opens; extension pages opened earlier die with the old one.
 */
export async function extensionShutdown(context: BrowserContext): Promise<void> {
  const worker =
    context.serviceWorkers().find((w) => w.url().startsWith(EXTENSION_SCHEME)) ??
    (await context.waitForEvent("serviceworker", { timeout: SERVICE_WORKER_TIMEOUT_MS }));

  await worker.waitForEvent("close", { timeout: SERVICE_WORKER_TIMEOUT_MS });
}

/**
 * Opens the popup at `url` in `page` (a new tab by default) once the extension serves it
 * again. Resolve `url` with {@link popupUrl} before locking: the id lookup needs a running
 * extension.
 * Lock restarts the whole extension (BrowserProcessReloadService), and its pages fail to
 * load meanwhile.
 */
export async function reopenPopup(
  context: BrowserContext,
  url: string,
  page?: Page,
): Promise<Page> {
  const tab = page ?? (await context.newPage());
  const deadline = Date.now() + REOPEN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const loaded = await tab
      .goto(url)
      .then(() => true)
      .catch(() => false);
    if (loaded) {
      return tab;
    }

    await tab.waitForTimeout(REOPEN_RETRY_MS);
  }

  throw new Error("The extension popup never loaded again.");
}

/**
 * A fresh install walks through onboarding — the "make Bitwarden your default password
 * manager" prompt, then the intro carousel — before it offers the login page.
 */
export async function reachLoginPage(page: Page) {
  const email = page.getByTestId("login-email-input");
  const skipDefaultPrompt = page.locator(SKIP_DEFAULT_MANAGER_BUTTON);
  // Scoped to the carousel: the login page has a "Log in" button of its own.
  const carouselLogIn = page
    .locator("app-intro-carousel")
    .getByRole("button", { name: "Log in", exact: true });

  const deadline = Date.now() + ONBOARDING_TIMEOUT_MS;

  while (Date.now() < deadline) {
    // Bootstrapping the popup runs state migrations, so each step takes a while to appear.
    await expect(email.or(skipDefaultPrompt).or(carouselLogIn).first()).toBeVisible({
      timeout: ONBOARDING_TIMEOUT_MS,
    });

    if (await email.isVisible()) {
      return;
    }

    await ((await skipDefaultPrompt.isVisible()) ? skipDefaultPrompt : carouselLogIn).click();
  }

  throw new Error("The extension popup never reached the login page.");
}

/** `popup` is the extension popup opened as a full page, which is how Playwright can drive it. */
export const test = base.extend<{ context: BrowserContext; popup: Page }>({
  context: async ({ baseURL }, use) => {
    const context = await launch(baseURL);
    await enableDeveloperMode(context);
    await use(context);
    await context.close();
  },
  popup: async ({ context }, use) => {
    const page = await context.newPage();
    await page.goto(await popupUrl(context));
    await reachLoginPage(page);

    await use(page);
  },
});

export { expect } from "@playwright/test";
