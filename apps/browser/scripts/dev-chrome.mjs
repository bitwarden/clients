#!/usr/bin/env node

////
// Launch Chrome for Testing with the unpacked extension from build/.
//
// Chrome restricts --load-extension on the stable channel, so this
// deliberately uses a Chrome for Testing binary, where the flag still
// works. The binary is resolved from the puppeteer cache and downloaded
// on first run.
//
//   node scripts/dev-chrome.mjs [--popup]
//
// --popup  open the extension popup once loaded
////

import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const BROWSER_DIR = resolve(SCRIPT_DIR, "..");
const BUILD_DIR = join(BROWSER_DIR, "build");
const REPO_ROOT = resolve(BROWSER_DIR, "../..");

// Shared with `npm run debug:desktop`, which writes the desktop client's native messaging
// manifest into this profile so the two debug instances can reach each other.
const PROFILE_DIR = join(REPO_ROOT, ".debug", "chrome-profile");

// The desktop client's IPC socket directory. Chrome spawns the native messaging proxy, so the
// proxy inherits this from Chrome's environment and finds the debug client's socket instead of
// the installed client's default one. Must match debug-start.js.
const IPC_SOCKET_DIR = join(REPO_ROOT, ".debug");

// Matches the chrome-devtools-attach server in the repo root .mcp.json and the vs code launch config.
const DEBUG_PORT = 9200;

// Chrome for Testing tracks the stable channel; dev builds need nothing newer.
const CHANNEL = "stable";
const SERVICE_WORKER = "service_worker";
const EXTENSION_SCHEME = "chrome-extension://";

const require = createRequire(import.meta.url);

function parseArgs(argv) {
  return {
    popup: argv.includes("--popup"),
  };
}

// puppeteer-core is intentionally not a dependency of this monorepo. Fail
// with the install line rather than a bare MODULE_NOT_FOUND.
function loadDeps() {
  try {
    return {
      puppeteer: require("puppeteer-core"),
      browsers: require("@puppeteer/browsers"),
    };
  } catch {
    throw new Error(
      "Missing dev dependencies. Install them first:\n" +
        "  npm install --no-save puppeteer-core @puppeteer/browsers",
    );
  }
}

async function assertBuilt() {
  try {
    await access(join(BUILD_DIR, "manifest.json"));
  } catch {
    throw new Error(`No build found at ${BUILD_DIR}. Run: npm run build:chrome`);
  }
}

// Reuse the cached Chrome for Testing download when present; install it
// on first run so a fresh clone needs no manual browser setup.
async function resolveChrome(browsers) {
  const cacheDir = join(process.env.HOME, ".cache", "puppeteer");
  const platform = browsers.detectBrowserPlatform();

  if (!platform) {
    throw new Error("Unsupported platform for Chrome for Testing downloads.");
  }

  const buildId = await browsers.resolveBuildId(browsers.Browser.CHROME, platform, CHANNEL);

  const installed = await browsers.install({
    browser: browsers.Browser.CHROME,
    buildId,
    cacheDir,
    platform,
  });

  return installed.executablePath;
}

async function launch(puppeteer, executablePath) {
  return puppeteer.launch({
    executablePath,
    headless: false,
    userDataDir: PROFILE_DIR,
    env: { ...process.env, BITWARDEN_IPC_SOCKET_DIR: IPC_SOCKET_DIR },
    defaultViewport: null,
    args: [
      `--load-extension=${BUILD_DIR}`,
      `--disable-extensions-except=${BUILD_DIR}`,
      `--remote-debugging-port=${DEBUG_PORT}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });
}

// The extension id is only knowable once its service worker registers.
async function waitForExtensionId(browser) {
  const target = await browser.waitForTarget(
    (t) => t.type() === SERVICE_WORKER && t.url().startsWith(EXTENSION_SCHEME),
    { timeout: 30_000 },
  );

  const url = new URL(target.url());

  return url.hostname;
}

async function openPopup(browser, extensionId) {
  const manifest = JSON.parse(await readFile(join(BUILD_DIR, "manifest.json"), "utf8"));
  const popup = manifest.action?.default_popup;

  if (!popup) {
    return;
  }

  const page = await browser.newPage();
  await page.goto(`${EXTENSION_SCHEME}${extensionId}/${popup}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { puppeteer, browsers } = loadDeps();

  await assertBuilt();

  const executablePath = await resolveChrome(browsers);
  console.log(`Chrome: ${executablePath}`);

  const browser = await launch(puppeteer, executablePath);
  const id = await waitForExtensionId(browser);

  console.log(`Extension: ${id}`);
  console.log(`Profile:   ${PROFILE_DIR}`);
  console.log(`DevTools:  http://localhost:${DEBUG_PORT}`);

  if (args.popup) {
    await openPopup(browser, id);
  }

  // Hold the process open until the browser window is closed.
  await new Promise((res) => browser.on("disconnected", res));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
