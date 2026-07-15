import * as fs from "node:fs";
import * as path from "node:path";

import { test as base, chromium, expect, type BrowserContext, type Page } from "@playwright/test";

import { resolveBuildTarget } from "./build-targets";

const repoRoot = path.resolve(__dirname, "../../../..");

// The Playwright project name maps to an Nx build configuration. A single explicit TARGETS entry
// (set by the per-browser npm script) wins; otherwise derive it from the project name.
function targetForProject(projectName: string): string {
  const explicit = (process.env.TARGETS ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (explicit.length === 1) {
    return explicit[0];
  }
  return `${projectName}-dev`;
}

export type ExtensionFixtures = {
  extensionId: string;
  /** Opens the popup at `route` and waits for `isRendered` to hold. Returns the popup page. */
  openPopup: (route: string, isRendered: (page: Page) => Promise<boolean>) => Promise<Page>;
};

export const test = base.extend<ExtensionFixtures>({
  context: async ({ channel }, use, testInfo) => {
    const target = targetForProject(testInfo.project.name);
    const { outputDir } = resolveBuildTarget(target);
    const extensionPath = path.join(repoRoot, outputDir);

    if (!fs.existsSync(path.join(extensionPath, "manifest.json"))) {
      throw new Error(
        `Built extension not found at ${extensionPath}. The config's globalSetup should have ` +
          `produced it — run \`npx nx build browser --configuration=${target}\`, or unset SKIP_BUILD.`,
      );
    }

    // MV3 background service workers don't fully start in headless Chrome, so the popup hangs on its
    // spinner. Run headed by default; HEADLESS=true is opt-in and known-broken.
    const headless = process.env.HEADLESS === "true";
    const args = [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      // Recent Chrome/Chromium disable command-line extension loading via this feature; without
      // turning it off the extension silently fails to load and no service worker ever registers.
      "--disable-features=DisableLoadExtensionCommandLineSwitch",
      "--ignore-certificate-errors",
    ];
    if (headless) {
      args.push("--headless=new");
    }

    // Use Playwright's bundled Chromium ("chromium" channel) rather than stable Chrome: stable
    // Chrome fully removed `--load-extension`, whereas the bundled build still honors it.
    const context: BrowserContext = await chromium.launchPersistentContext("", {
      channel: channel ?? "chromium",
      headless,
      ignoreHTTPSErrors: true,
      args,
      slowMo: parseInt(process.env.PLAYWRIGHT_SLOW_MO ?? "0", 10),
    });

    // Installing the extension opens a welcome/onboarding tab. Give it a beat to appear, then close
    // every page so popup navigation starts from a clean slate.
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    await Promise.all(context.pages().map((p) => p.close().catch((): void => undefined)));

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // The MV3 background runs as a service worker; the host of its URL is the extension id.
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent("serviceworker", { timeout: 30_000 });
    }
    await use(new URL(worker.url()).host);
  },

  openPopup: async ({ context, extensionId }, use) => {
    const open = async (route: string, isRendered: (page: Page) => Promise<boolean>) => {
      const page = await context.newPage();
      // A cold MV3 worker answers the popup's init messaging slowly, and reloading restarts that
      // handshake — so navigate once and then wait patiently (no reload retry).
      await page.goto(`chrome-extension://${extensionId}/popup/index.html${route}`);
      await expect
        .poll(() => isRendered(page), { timeout: 90_000, intervals: [1000] })
        .toBeTruthy();
      return page;
    };
    await use(open);
  },
});

export { expect };
