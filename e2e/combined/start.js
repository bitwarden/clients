/* eslint-disable @typescript-eslint/no-require-imports */

////
// Starts the desktop app and the extension's debug browser together and pairs them
// over native messaging, which is what the extension's biometric unlock rides on.
//
// Both debug runs already point at the same IPC socket dir (`.debug`): the desktop
// app listens on `.debug/s.bw*`, and `dev-chrome.mjs` exports
// BITWARDEN_IPC_SOCKET_DIR so the proxy Chrome spawns dials that socket instead of
// the installed client's. What is missing locally is the native messaging manifest
// for the debug extension: the desktop app writes manifests for the real browser
// profiles and discovers extension ids from them, and it can neither see the debug
// Chrome profile nor its id. So this script writes that manifest itself, once the
// extension id is known.
//
//   desktop (Electron, :9222) ── .debug/s.bw ── desktop_proxy ── Chrome (:9200)
//                                                    ▲
//                          .debug/chrome-profile/NativeMessagingHosts/…json
//
// Playwright's `webServer` waits on the readiness URL served at the end, so tests
// only start once both clients are up and paired.
////

const { execFileSync, spawn, spawnSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const rimraf = require("rimraf");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEBUG_DIR = path.join(REPO_ROOT, ".debug");
const DESKTOP_PROFILE_DIR = path.join(DEBUG_DIR, "desktop-profile");
const CHROME_PROFILE_DIR = path.join(DEBUG_DIR, "chrome-profile");

// Chrome resolves native messaging manifests relative to its user data dir, so the
// debug profile gets its own manifest and the host system's is left alone.
const MANIFEST_DIR = path.join(CHROME_PROFILE_DIR, "NativeMessagingHosts");
const MANIFEST_NAME = "com.8bit.bitwarden.json";
const PROXY_BINARY = path.join(
  REPO_ROOT,
  "apps",
  "desktop",
  "desktop_native",
  "target",
  "debug",
  "desktop_proxy",
);

const EXTENSION_BUILD_DIR = path.join(REPO_ROOT, "apps", "browser", "build");
const EXTENSION_MANIFEST = path.join(EXTENSION_BUILD_DIR, "manifest.json");
const DEV_CHROME_SCRIPT = path.join(REPO_ROOT, "apps", "browser", "scripts", "dev-chrome.mjs");
const NATIVE_MESSAGING_PERMISSION = "nativeMessaging";

const DESKTOP_CDP_PORT = 9222;
const BROWSER_CDP_PORT = 9200;
const READY_PORT = 9250;

const EXTENSION_SCHEME = "chrome-extension://";
const SERVICE_WORKER = "service_worker";

const CLIENT_START_TIMEOUT = 15 * 60 * 1000;
const POLL_INTERVAL = 1000;

const children = [];

// Chrome ignores SIGTERM sent to the npm wrapper that launched it, so a previous
// run can leave a browser holding the debug profile and the debugging port. It
// must be reaped, or this run would silently attach to a stale, logged-in client.
// The desktop app reaps its own strays (see debug-start.js).
function killStrayBrowsers() {
  try {
    // No leading dashes in the pattern: pkill would read it as an option.
    execFileSync("pkill", ["-9", "-f", `user-data-dir=${CHROME_PROFILE_DIR}`]);
  } catch {
    // pkill exits non-zero when nothing matched, and does not exist on Windows.
  }
}

/** Refuses to run against clients this script did not start: their state is unknown. */
async function assertPortFree(port, what) {
  if ((await fetchTargets(port)) != null) {
    throw new Error(`Something is already listening on ${port} (${what}). Stop it first.`);
  }
}

function startClient(command, args) {
  const child = spawn(command, args, { cwd: REPO_ROOT, stdio: "inherit" });

  children.push(child);
  child.on("exit", (code, signal) => shutdown(signal ? 1 : (code ?? 0)));

  return child;
}

function shutdown(code) {
  for (const child of children) {
    child.kill("SIGTERM");
  }

  killStrayBrowsers();
  process.exit(code);
}

async function waitForCdp(port, what) {
  const deadline = Date.now() + CLIENT_START_TIMEOUT;

  while (Date.now() < deadline) {
    const targets = await fetchTargets(port);

    if (targets != null) {
      return targets;
    }

    await sleep(POLL_INTERVAL);
  }

  throw new Error(`${what} did not open its debugging port (${port}) in time.`);
}

async function fetchTargets(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);

    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

/** The extension id is only knowable once its service worker registers. */
async function waitForExtensionId() {
  const deadline = Date.now() + CLIENT_START_TIMEOUT;

  while (Date.now() < deadline) {
    const targets = (await fetchTargets(BROWSER_CDP_PORT)) ?? [];
    const worker = targets.find(
      (target) => target.type === SERVICE_WORKER && target.url.startsWith(EXTENSION_SCHEME),
    );

    if (worker != null) {
      return new URL(worker.url).hostname;
    }

    await sleep(POLL_INTERVAL);
  }

  throw new Error("The extension's service worker never registered.");
}

/**
 * Builds the extension and makes `nativeMessaging` a required permission instead
 * of an optional one.
 *
 * Shipped, it is optional: enabling biometric unlock or unlock sharing asks Chrome
 * for it, and Chrome answers with its own permission bubble. That bubble is browser
 * UI, so no test can click it, and the extension pops out and reloads itself around
 * the request. Required permissions are granted at install, so the settings behave
 * as they do for a user who has already said yes.
 */
function buildExtensionWithGrantedNativeMessaging() {
  const build = spawnSync("npm", ["run", "build:chrome"], {
    cwd: path.join(REPO_ROOT, "apps", "browser"),
    stdio: "inherit",
  });

  if (build.status !== 0) {
    throw new Error("Building the extension failed.");
  }

  const manifest = JSON.parse(fs.readFileSync(EXTENSION_MANIFEST, "utf8"));

  manifest.permissions = [...manifest.permissions, NATIVE_MESSAGING_PERMISSION];
  manifest.optional_permissions = manifest.optional_permissions.filter(
    (permission) => permission !== NATIVE_MESSAGING_PERMISSION,
  );

  fs.writeFileSync(EXTENSION_MANIFEST, JSON.stringify(manifest, null, 2));
}

function writeManifest(extensionId) {
  if (!fs.existsSync(PROXY_BINARY)) {
    throw new Error(
      `Missing proxy binary: ${PROXY_BINARY}. Build it with \`npm run build-native --workspace @bitwarden/desktop\`.`,
    );
  }

  fs.mkdirSync(MANIFEST_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(MANIFEST_DIR, MANIFEST_NAME),
    JSON.stringify(
      {
        name: "com.8bit.bitwarden",
        description: "Bitwarden desktop <-> browser bridge (e2e debug pairing)",
        path: PROXY_BINARY,
        type: "stdio",
        allowed_origins: [`${EXTENSION_SCHEME}${extensionId}/`],
      },
      null,
      2,
    ),
  );
}

function serveReadiness() {
  http
    .createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("ready");
    })
    .listen(READY_PORT, "127.0.0.1");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  killStrayBrowsers();

  rimraf.sync(DESKTOP_PROFILE_DIR);
  rimraf.sync(CHROME_PROFILE_DIR);

  await assertPortFree(DESKTOP_CDP_PORT, "the desktop app");
  await assertPortFree(BROWSER_CDP_PORT, "the debug browser");

  // The desktop app first: it owns the IPC socket the proxy connects to.
  startClient("npm", ["run", "debug:desktop:automation"]);
  await waitForCdp(DESKTOP_CDP_PORT, "The desktop app");

  // Built here rather than by the launcher, which would overwrite the patch.
  buildExtensionWithGrantedNativeMessaging();
  startClient("node", [DEV_CHROME_SCRIPT, "--popup", "--skip-build"]);
  await waitForCdp(BROWSER_CDP_PORT, "The debug browser");

  const extensionId = await waitForExtensionId();
  writeManifest(extensionId);
  console.log(`Paired native messaging with extension ${extensionId}`);

  serveReadiness();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}

main().catch((error) => {
  console.error(error.message);
  shutdown(1);
});
