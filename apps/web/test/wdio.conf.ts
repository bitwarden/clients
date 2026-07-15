import * as fs from "node:fs";
import * as path from "node:path";

import * as dotenv from "dotenv";

import { load as loadWebConfig } from "../config.js";

const parseEnvFile = (file: string): Record<string, string> => {
  const full = path.resolve(__dirname, file);
  return fs.existsSync(full) ? dotenv.parse(fs.readFileSync(full)) : {};
};

// The environment to target, reusing the web app's build `ENV` (see apps/web/package.json
// `build:bit:*` scripts and apps/web/config/${ENV}.json). Resolved before the per-environment
// file is loaded: a real shell/CI `ENV` wins, else the base `.env` may set a default.
const base = parseEnvFile(".env");
const ENV = process.env.ENV ?? base.ENV ?? "development";

// Layer .env files like config.js: shared `.env` base < per-environment `.env.${ENV}`. Apply
// without clobbering vars already set in the real environment (e.g. CI-injected secrets), which
// must win over any file.
const fromFiles = { ...base, ...parseEnvFile(`.env.${ENV}`) };
for (const [key, value] of Object.entries(fromFiles)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

// The web dev server uses a self-signed cert; allow Node-side requests to it.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Maps an `ENV` value to the region `key` whose vault URL to use, since a config file's
// `additionalRegions` can list several regions and the primary one isn't consistently first.
const ENV_REGION_KEY: Record<string, string> = {
  development: "LOCAL",
  usdev: "USDEV",
  qa: "USQA",
  usqa2: "USQA2",
  euqa: "EUQA",
};

function deriveVaultUrl(env: string): string | undefined {
  const cfg = loadWebConfig(env);
  const region = cfg.additionalRegions?.find((r: { key: string }) => r.key === ENV_REGION_KEY[env]);
  return region?.urls?.webVault;
}

// The environment's configured vault URL, falling back to local dev.
const baseUrl = deriveVaultUrl(ENV) ?? "https://localhost:8080";
const headless = process.env.HEADLESS !== "false";

const chromeArgs = ["--ignore-certificate-errors"];
const firefoxArgs: string[] = [];
// Edge is Chromium-based, so it takes the same flags as Chrome.
const edgeArgs = ["--ignore-certificate-errors"];
if (headless) {
  chromeArgs.push("--headless=new", "--disable-gpu");
  firefoxArgs.push("-headless");
  edgeArgs.push("--headless=new", "--disable-gpu");
}

// Which browsers to run. Comma-separated `BROWSERS` env var (e.g. "chrome,firefox");
// defaults to chrome only so local runs stay fast — CI can opt into the full matrix.
// Safari has no headless mode and is macOS-only, so `HEADLESS` is ignored for it.
const capabilitiesByBrowser: Record<string, WebdriverIO.Capabilities> = {
  chrome: {
    browserName: "chrome",
    acceptInsecureCerts: true,
    "goog:chromeOptions": { args: chromeArgs },
  },
  firefox: {
    browserName: "firefox",
    acceptInsecureCerts: true,
    "moz:firefoxOptions": { args: firefoxArgs },
  },
  edge: {
    browserName: "MicrosoftEdge",
    acceptInsecureCerts: true,
    "ms:edgeOptions": { args: edgeArgs },
  },
  safari: {
    browserName: "safari",
    acceptInsecureCerts: true,
  },
};

const requestedBrowsers = (process.env.BROWSERS ?? "chrome")
  .split(",")
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);

const capabilities = requestedBrowsers.map((name) => {
  const capability = capabilitiesByBrowser[name];
  if (!capability) {
    throw new Error(
      `Unknown browser "${name}" in BROWSERS. Supported: ${Object.keys(capabilitiesByBrowser).join(", ")}`,
    );
  }
  return capability;
});

const artifactsDir = path.resolve(__dirname, "artifacts");
let consoleLogs: string[] = [];

const slugify = (...parts: string[]): string =>
  parts
    .join(" ")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);

export const config: WebdriverIO.Config = {
  runner: "local",
  tsConfigPath: path.resolve(__dirname, "../../../tsconfig.wdio.json"),

  specs: ["./smoke/**/*.e2e.ts"],
  maxInstances: 1,

  baseUrl,

  capabilities,

  logLevel: "warn",
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
  },

  onPrepare() {
    fs.rmSync(artifactsDir, { recursive: true, force: true });
    fs.mkdirSync(artifactsDir, { recursive: true });
  },

  async before() {
    await browser.maximizeWindow();
    await browser.sessionSubscribe({ events: ["log.entryAdded"] });
    browser.on("log.entryAdded", (entry) => {
      consoleLogs.push(`[${entry.level}] ${entry.text ?? ""}`);
    });
  },

  beforeTest() {
    consoleLogs = [];
  },

  async afterTest(test, _context, result) {
    if (result.passed) {
      return;
    }

    const browserName = browser.capabilities.browserName ?? "browser";
    const name = slugify(browserName, test.parent, test.title);
    await browser.saveScreenshot(path.join(artifactsDir, `${name}.png`));

    const url = await browser.getUrl().catch(() => "<unknown>");
    const tags = await browser
      .execute(() =>
        Array.from(
          new Set(
            Array.from(document.querySelectorAll("*"))
              .map((el) => el.tagName.toLowerCase())
              .filter((tag) => tag.includes("-")),
          ),
        )
          .sort()
          .join("\n"),
      )
      .catch(() => "<unavailable>");

    const report = [
      `url: ${url}`,
      "",
      "== custom element tags ==",
      tags,
      "",
      "== browser console ==",
      ...consoleLogs,
    ].join("\n");
    fs.writeFileSync(path.join(artifactsDir, `${name}.log`), report, "utf8");
  },
};
