import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { BrowserContext, Page, chromium, expect, test as base } from "@playwright/test";

import { pruneVideo, videoDir } from "../artifacts";
import { BROWSER_BUILD_DIR, CHROME_PROFILE_DIR, E2E_STATE_DIR } from "../paths";
import { IS_DEV_SERVER } from "../server";

// A copy of the build whose manifest grants nativeMessaging, see `NativeMessaging.Granted`.
const GRANTED_BUILD_DIR = resolve(E2E_STATE_DIR, "browser-build-native-messaging");
const NATIVE_MESSAGING_PERMISSION = "nativeMessaging";
// Where the desktop app's native IPC listens; the proxy Chromium spawns inherits it.
const IPC_SOCKET_DIR = E2E_STATE_DIR;
const EXTENSION_SCHEME = "chrome-extension://";
const SERVICE_WORKER_TIMEOUT_MS = 30_000;
const ONBOARDING_TIMEOUT_MS = 60_000;
const EXTENSIONS_PAGE = "chrome://extensions";
const DEVELOPER_MODE_TOGGLE = "#devMode";
const SKIP_DEFAULT_MANAGER_BUTTON = "#default-password-manager-prompt_button_skip-for-now";

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
  // A switch with aria-checked in current Chromium; Playwright reads its state as checked.
  if (!(await toggle.isChecked())) {
    await toggle.click();
  }
  await expect(toggle).toBeChecked();

  await page.close();
}

/** Whether the extension holds the optional nativeMessaging permission it needs to reach desktop. */
export const NativeMessaging = Object.freeze({
  Optional: "optional",
  // Granting asks through a Chromium prompt Playwright cannot answer, so the manifest requires it.
  Granted: "granted",
} as const);
export type NativeMessaging = (typeof NativeMessaging)[keyof typeof NativeMessaging];

/** Copies the build, moving nativeMessaging from optional to required permissions. */
function grantedBuild(): string {
  rmSync(GRANTED_BUILD_DIR, { recursive: true, force: true });
  cpSync(BROWSER_BUILD_DIR, GRANTED_BUILD_DIR, { recursive: true });

  const path = join(GRANTED_BUILD_DIR, "manifest.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.optional_permissions = manifest.optional_permissions.filter(
    (p: string) => p !== NATIVE_MESSAGING_PERMISSION,
  );
  manifest.permissions.push(NATIVE_MESSAGING_PERMISSION);
  writeFileSync(path, JSON.stringify(manifest, null, 2));

  return GRANTED_BUILD_DIR;
}

async function launch(
  baseURL: string | undefined,
  recordVideoDir: string,
  nativeMessaging: NativeMessaging,
): Promise<BrowserContext> {
  rmSync(CHROME_PROFILE_DIR, { recursive: true, force: true });
  const extensionDir =
    nativeMessaging === NativeMessaging.Granted ? grantedBuild() : BROWSER_BUILD_DIR;

  return chromium.launchPersistentContext(CHROME_PROFILE_DIR, {
    channel: "chromium",
    headless: false,
    // The local dev server serves a self-signed certificate.
    ignoreHTTPSErrors: IS_DEV_SERVER,
    // Lets suites that also drive the web vault use relative URLs in this context.
    baseURL,
    recordVideo: { dir: recordVideoDir },
    env: { ...process.env, BITWARDEN_IPC_SOCKET_DIR: IPC_SOCKET_DIR },
    args: [`--load-extension=${extensionDir}`, `--disable-extensions-except=${extensionDir}`],
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
export const test = base.extend<{
  nativeMessaging: NativeMessaging;
  context: BrowserContext;
  popup: Page;
}>({
  nativeMessaging: [NativeMessaging.Optional, { option: true }],
  context: async ({ baseURL, nativeMessaging }, use, testInfo) => {
    // Playwright traces this context itself: it comes from its instrumented `chromium`.
    const context = await launch(baseURL, videoDir(testInfo), nativeMessaging);
    await enableDeveloperMode(context);

    await use(context);

    await context.close();
    pruneVideo(testInfo);
  },
  popup: async ({ context }, use) => {
    const page = await context.newPage();
    await page.goto(await popupUrl(context));
    await reachLoginPage(page);

    await use(page);
  },
});

export { expect } from "@playwright/test";
