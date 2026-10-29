import { rmSync } from "node:fs";
import { resolve } from "node:path";

import { BrowserContext, chromium, expect, test as base } from "@playwright/test";

import { BROWSER_BUILD_DIR, E2E_STATE_DIR } from "../../paths";

const PROFILE_DIR = resolve(E2E_STATE_DIR, "chrome-profile-memory");
const EXTENSIONS_PAGE = "chrome://extensions";
const DEVELOPER_MODE_TOGGLE = "#devMode";
// The toggle is a `cr-toggle` switch, which reports its state through aria-checked.
const TOGGLE_STATE = "aria-checked";
const DEBUGGING_PORT = 9333;

/**
 * Like the browser fixture (../fixtures.ts), minus tracing and video: both keep
 * snapshots of the pages they record, which would show up in the heaps measured.
 * Opens the remote debugging port, through which `probe.ts` reaches the service worker.
 */
export const test = base.extend<{ context: BrowserContext; debuggingPort: number }>({
  debuggingPort: DEBUGGING_PORT,
  context: async ({ debuggingPort }, use, testInfo) => {
    rmSync(PROFILE_DIR, { recursive: true, force: true });

    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
      channel: "chromium",
      headless: false,
      args: [
        `--load-extension=${BROWSER_BUILD_DIR}`,
        `--disable-extensions-except=${BROWSER_BUILD_DIR}`,
        `--remote-debugging-port=${debuggingPort}`,
      ],
    });

    // Lock restarts the extension, which Chromium only allows in developer mode.
    const page = await context.newPage();
    await page.goto(EXTENSIONS_PAGE);
    const toggle = page.locator(DEVELOPER_MODE_TOGGLE);
    if ((await toggle.getAttribute(TOGGLE_STATE)) !== "true") {
      await toggle.click();
    }
    await expect(toggle).toHaveAttribute(TOGGLE_STATE, "true");
    await page.close();

    await use(context);

    // Without tracing, screenshots are what's left to see where a failing run stopped.
    if (testInfo.status !== testInfo.expectedStatus) {
      for (const [index, open] of context.pages().entries()) {
        await open.screenshot({ path: testInfo.outputPath(`page-${index}.png`) });
      }
    }

    await context.close();
  },
});

export { expect } from "@playwright/test";
