import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";

import * as dotenv from "dotenv";

import {
  FIREFOX_ADDON_ID,
  FIREFOX_EXTENSION_UUID,
  resolveBuildTarget,
} from "./support/build-targets";
import { installExtension } from "./support/install-extension";
import { closeOtherWindows, waitForWindowCount } from "./support/windows";

const parseEnvFile = (file: string): Record<string, string> => {
  const full = path.resolve(__dirname, file);
  return fs.existsSync(full) ? dotenv.parse(fs.readFileSync(full)) : {};
};

// The environment to target, reused to pick a per-environment `.env.${ENV}` file. A real shell/CI
// `ENV` wins, else the base `.env` may set a default.
const base = parseEnvFile(".env");
const ENV = process.env.ENV ?? base.ENV ?? "development";

// Layer .env files: shared `.env` base < per-environment `.env.${ENV}`. Apply without clobbering
// vars already set in the real environment (e.g. CI-injected secrets), which must win over a file.
const fromFiles = { ...base, ...parseEnvFile(`.env.${ENV}`) };
for (const [key, value] of Object.entries(fromFiles)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

// The extension talks to a self-signed dev server; allow Node-side requests to it.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// The server URL the extension is pointed at via the login environment selector. Read by the spec.
process.env.BW_SERVER_URL = process.env.BW_SERVER_URL ?? "https://localhost:8080";

// The extension runs HEADED by default: in headless Chrome the MV3 background service worker does
// not fully initialize, so the popup hangs on its loading spinner forever. Opt into headless
// explicitly with HEADLESS=true only if a future browser/driver fixes that.
const headless = process.env.HEADLESS === "true";

// Chrome for Testing reports a `HeadlessChrome` user-agent when driven by the driver. The
// extension's platform detection (`isBrowserSafariApi`) classifies a UA that contains " Safari/"
// but neither " Chrome/" nor " Chromium/" as Safari — which sends the browser
// `VaultTimeoutService` into an unthrottled native-messaging loop (`browser.runtime.sendNativeMessage`
// does not exist off-Safari) that starves the MV3 background service worker and hangs the popup on
// its spinner. Force a standard Chrome UA so the extension detects Chrome regardless of the
// headed/headless UA token.
const chromeUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";
const chromiumArgs = ["--ignore-certificate-errors", `--user-agent=${chromeUserAgent}`];
const firefoxArgs: string[] = [];
if (headless) {
  chromiumArgs.push("--headless=new", "--disable-gpu");
  firefoxArgs.push("-headless");
}

// Which builds to run. Comma-separated `TARGETS` env var of Nx build-configuration names (e.g.
// "chrome-dev,edge-dev,firefox-mv2-dev"); the browser to launch and the installed build are both
// derived from each name. Defaults to `chrome-dev` so local runs stay fast — CI can opt into the
// full matrix. The extension is installed via WebDriver BiDi `webExtension.install`, and
// `webSocketUrl: true` opts each session into a BiDi-capable connection.
const targets = (process.env.TARGETS ?? "chrome-dev")
  .split(",")
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);

const capabilities = targets.map((target) => {
  const { browserName, optionsKey } = resolveBuildTarget(target);
  const args = browserName === "firefox" ? firefoxArgs : chromiumArgs;
  // Vendor-specific launch options. Firefox needs its per-profile extension UUID pinned via the
  // `extensions.webextensions.uuids` pref (see FIREFOX_EXTENSION_UUID); Chromium needs no such pref.
  const vendorOptions: Record<string, unknown> = { args };
  if (browserName === "firefox") {
    vendorOptions.prefs = {
      "extensions.webextensions.uuids": JSON.stringify({
        [FIREFOX_ADDON_ID]: FIREFOX_EXTENSION_UUID,
      }),
    };
  }
  // Built as an untyped record: the vendor options key is computed and `bw:buildTarget` is a custom
  // key (read back from `requestedCapabilities` by the installer to know which build to load).
  const capability: Record<string, unknown> = {
    browserName,
    acceptInsecureCerts: true,
    webSocketUrl: true,
    [optionsKey]: vendorOptions,
    "bw:buildTarget": target,
  };
  return capability as WebdriverIO.Capabilities;
});

const artifactsDir = path.resolve(__dirname, "artifacts");
const repoRoot = path.resolve(__dirname, "../../..");
const execFileAsync = promisify(execFile);
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

  capabilities,

  logLevel: "warn",
  // The extension popup renders slower than a plain web page (SW startup + state hydration), so
  // allow more slack than the web suite's 10s default.
  waitforTimeout: 20000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    // Generous: the sign-in test opens the popup twice (initial + post-environment-change reload)
    // and each open may retry through a stalled background handshake.
    timeout: 240000,
  },

  async onPrepare() {
    fs.rmSync(artifactsDir, { recursive: true, force: true });
    fs.mkdirSync(artifactsDir, { recursive: true });

    // Build each target so the popup never runs a stale dist. `SKIP_BUILD=true` opts out.
    if (process.env.SKIP_BUILD === "true") {
      return;
    }
    // The build derives webpack `mode` from NODE_ENV; the WDIO runner sets `NODE_ENV=test` (not a
    // valid mode), so drop it and let the Nx config pick the per-target mode.
    const buildEnv = { ...process.env };
    delete buildEnv.NODE_ENV;
    delete buildEnv.ENV;
    // The targets are independent Nx configurations emitting to distinct
    // `dist/apps/browser/<target>` dirs, so build them concurrently. Each build's output is
    // buffered and printed on completion (rather than `stdio: "inherit"`) so parallel logs
    // don't interleave into noise. maxBuffer is raised well past the 1MB default because Nx +
    // webpack output easily exceeds it.
    const results = await Promise.allSettled(
      targets.map((target) =>
        execFileAsync("npx", ["nx", "build", "browser", `--configuration=${target}`], {
          cwd: repoRoot,
          env: buildEnv,
          maxBuffer: 100 * 1024 * 1024,
        }).then(({ stdout }) => {
          process.stdout.write(`\n== build ${target} ==\n${stdout}`);
        }),
      ),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      // A throw from onPrepare doesn't stop WDIO (it would then run against a stale dist and
      // report a false green), so exit hard to fail the run on a build break.
      for (const failure of failed) {
        process.stderr.write(`${(failure as PromiseRejectedResult).reason}\n`);
      }
      process.stderr.write(`\nBuild(s) failed; aborting E2E run.\n`);
      process.exit(1);
    }
  },

  async before() {
    await browser.sessionSubscribe({ events: ["log.entryAdded"] });
    browser.on("log.entryAdded", (entry) => {
      consoleLogs.push(`[${entry.level}] ${entry.text ?? ""}`);
    });
    await installExtension();
    // Installing the extension pops an onboarding/welcome tab in Chromium; keep only the original
    // WebDriver-controlled window so popup navigations run in a clean context.
    await waitForWindowCount(2);
    await closeOtherWindows();
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
