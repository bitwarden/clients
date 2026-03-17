/**
 * Launches Chrome with the built extension loaded, navigates to the
 * remote-access-test page, clicks "Load WASM + Generate Identity",
 * and prints all console output.
 *
 * Usage: npx playwright test --config /dev/null check-test-page.mjs
 *    or: node check-test-page.mjs
 */

import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../../../../build");

async function main() {
  console.log("Launching Chrome with extension from:", extensionPath);

  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
      "--disable-gpu",
    ],
  });

  // Wait for the service worker to register and get the extension ID
  let extensionId;
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    const workers = context.serviceWorkers();
    const extWorker = workers.find((w) => w.url().includes("chrome-extension://"));
    if (extWorker) {
      extensionId = extWorker.url().split("/")[2];
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!extensionId) {
    // Fallback: try background pages
    const pages = context.backgroundPages();
    if (pages.length > 0) {
      extensionId = pages[0].url().split("/")[2];
    }
  }

  if (!extensionId) {
    console.error("ERROR: Could not find extension ID");
    await context.close();
    process.exit(1);
  }

  console.log("Extension ID:", extensionId);

  // Navigate to the test page
  const testUrl = `chrome-extension://${extensionId}/popup/index.html#/remote-access-test`;
  console.log("Navigating to:", testUrl);

  const page = await context.newPage();

  // Capture all console output
  page.on("console", (msg) => {
    const type = msg.type().toUpperCase().padEnd(7);
    console.log(`[PAGE ${type}] ${msg.text()}`);
  });

  page.on("pageerror", (err) => {
    console.error(`[PAGE ERROR] ${err.message}`);
  });

  await page.goto(testUrl);
  console.log("Page loaded. Waiting for Angular to bootstrap...");

  // Wait for the page to render
  await page.waitForTimeout(3000);

  // Try to find and click the "Load WASM + Generate Identity" button
  const initButton = page.getByRole("button", { name: /load wasm/i });
  const buttonVisible = await initButton.isVisible().catch(() => false);

  if (buttonVisible) {
    console.log("\n--- Clicking 'Load WASM + Generate Identity' ---");
    await initButton.click();

    // Wait for the SDK to load and log output
    await page.waitForTimeout(5000);

    // Read the log entries from the page
    const logText = await page
      .locator(".tw-font-mono.tw-text-xs .tw-py-0\\.5")
      .allTextContents()
      .catch(() => []);

    console.log("\n--- Log entries from test page ---");
    for (const entry of logText) {
      console.log(`  ${entry}`);
    }

    // Read status
    const status = await page
      .locator("bit-callout")
      .textContent()
      .catch(() => "unknown");
    console.log(`\n--- Status: ${status?.trim()} ---`);
  } else {
    console.log("WARNING: Init button not found. The page may require authentication first.");
    console.log("Taking screenshot...");
    await page.screenshot({ path: "/tmp/rat-test-page.png" });
    console.log("Screenshot saved to /tmp/rat-test-page.png");

    // Print page content for debugging
    const bodyText = await page
      .locator("body")
      .textContent()
      .catch(() => "");
    console.log("Page body text:", bodyText?.slice(0, 500));
  }

  // Keep browser open for 5 seconds to observe
  console.log("\nClosing in 5 seconds...");
  await page.waitForTimeout(5000);

  await context.close();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
