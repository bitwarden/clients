import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

import { BrowserContext, Page, chromium, expect, test as base } from "@playwright/test";

import { BROWSER_BUILD_DIR, E2E_STATE_DIR } from "../paths";

const PROFILE_DIR = resolve(E2E_STATE_DIR, "chrome-profile");
const EXTENSION_SCHEME = "chrome-extension://";
const SERVICE_WORKER_TIMEOUT_MS = 30_000;
const ONBOARDING_TIMEOUT_MS = 60_000;
const SKIP_DEFAULT_MANAGER_BUTTON = "#default-password-manager-prompt_button_skip-for-now";

/**
 * Extensions load only into a persistent context. Chromium's new headless mode does
 * register the service worker, but the popup never bootstraps past its loading
 * spinner there, so this suite is always headed and ignores `--headed`.
 */
async function launch(): Promise<BrowserContext> {
  rmSync(PROFILE_DIR, { recursive: true, force: true });

  return chromium.launchPersistentContext(PROFILE_DIR, {
    channel: "chromium",
    headless: false,
    // The local dev server serves a self-signed certificate.
    ignoreHTTPSErrors: true,
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

/**
 * A fresh install walks through onboarding — the "make Bitwarden your default password
 * manager" prompt, then the intro carousel — before it offers the login page.
 */
async function reachLoginPage(page: Page) {
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
  context: async ({}, use) => {
    const context = await launch();
    await use(context);
    await context.close();
  },
  popup: async ({ context }, use) => {
    const id = await extensionId(context);

    const page = await context.newPage();
    await page.goto(`${EXTENSION_SCHEME}${id}/${popupPath()}`);
    await reachLoginPage(page);

    await use(page);
  },
});

export { expect } from "@playwright/test";
