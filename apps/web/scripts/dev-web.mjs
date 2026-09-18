#!/usr/bin/env node

////
// Build the web vault, serve the build output, and open it in Chrome for Testing
// with a remote debugging port.
//
//   node scripts/dev-web.mjs [--env <name>] [--port <port>]
//
// --env   web config from apps/web/config/ (default: usdev)
// --port  port for the static server (default: 8081)
//
// This serves a finished production build, not the webpack dev server, so
// nothing is proxied: the config's URLs must be absolute and reachable.
////

import { spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(SCRIPT_DIR, "..");
const BUILD_DIR = join(WEB_DIR, "build");
const REPO_ROOT = resolve(WEB_DIR, "../..");

// Kept out of personal browsing data, alongside the other debug profiles.
const PROFILE_DIR = join(REPO_ROOT, ".debug", "web-chrome-profile");

// One above the extension debug port (see apps/browser/scripts/dev-chrome.mjs), so both
// debug browsers can run at once.
const DEBUG_PORT = 9201;

const DEFAULT_ENV = "usdev";
const DEFAULT_PORT = 8081;

// Chrome for Testing tracks the stable channel; dev builds need nothing newer.
const CHANNEL = "stable";

const BUILD_SCRIPT = "build:oss";
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

const INDEX_FILE = "index.html";
const CONTENT_TYPES = {
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const value = (flag, fallback) => {
    const index = argv.indexOf(flag);
    return index === -1 ? fallback : argv[index + 1];
  };

  return {
    env: value("--env", DEFAULT_ENV),
    port: Number(value("--port", DEFAULT_PORT)),
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

// Always rebuild so the served vault matches the current working tree.
function build(env) {
  console.log(`Building web vault (ENV=${env})...`);

  const result = spawnSync(NPM, ["run", BUILD_SCRIPT], {
    cwd: WEB_DIR,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ENV: env, NODE_ENV: "production" },
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`npm run ${BUILD_SCRIPT} failed.`);
  }
}

/**
 * Static file server for the build output. Unknown paths fall back to
 * index.html, because the vault is a single-page app with real routes.
 */
function serve(port) {
  const server = createServer(async (request, response) => {
    const file = await resolveFile(request.url);

    if (file == null) {
      response.writeHead(HTTP_NOT_FOUND);
      response.end("Not found");
      return;
    }

    response.writeHead(HTTP_OK, {
      "Content-Type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
    });
    createReadStream(file).pipe(response);
  });

  return new Promise((res) => server.listen(port, () => res(server)));
}

async function resolveFile(url) {
  const requested = decodeURIComponent(new URL(url, "http://localhost").pathname);

  // normalize() collapses `..` segments, so nothing outside the build dir is reachable.
  const candidate = join(BUILD_DIR, normalize(requested));
  if (candidate.startsWith(BUILD_DIR) && (await isFile(candidate))) {
    return candidate;
  }

  const index = join(BUILD_DIR, INDEX_FILE);

  return (await isFile(index)) ? index : null;
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

// Reuse the cached Chrome for Testing download when present; install it
// on first run so a fresh clone needs no manual browser setup.
async function resolveChrome(browsers) {
  const cacheDir = join(homedir(), ".cache", "puppeteer");
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

async function launch(puppeteer, executablePath, url) {
  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    userDataDir: PROFILE_DIR,
    defaultViewport: null,
    args: [`--remote-debugging-port=${DEBUG_PORT}`, "--no-first-run", "--no-default-browser-check"],
  });

  const [page] = await browser.pages();
  await page.goto(url);

  return browser;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { puppeteer, browsers } = loadDeps();

  build(args.env);

  const server = await serve(args.port);
  const url = `http://localhost:${args.port}`;

  const executablePath = await resolveChrome(browsers);
  console.log(`Chrome:   ${executablePath}`);

  const browser = await launch(puppeteer, executablePath, url);

  console.log(`Serving:  ${url} (from ${BUILD_DIR})`);
  console.log(`Profile:  ${PROFILE_DIR}`);
  console.log(`DevTools: http://localhost:${DEBUG_PORT}`);

  // Hold the process open until the browser window is closed.
  await new Promise((res) => browser.on("disconnected", res));
  server.close();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
