/* eslint-disable @typescript-eslint/no-require-imports */

////
// Runs the locally built CLI against the same isolated state as `debug:desktop`, so the two can
// talk over shared unlock without touching the host's real Bitwarden installation.
//
//   .debug/cli-profile/   CLI app data (session, vault cache, config)
//   .debug/s.<name>       IPC sockets, shared with the debug desktop app
//
// The CLI is rebuilt on every invocation, unless NO_BUILD is set.
//
// Usage: npm run debug:cli -- login --help
//        NO_BUILD=1 npm run debug:cli -- login --help
////

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);

const CLI_DIR = path.resolve(__dirname, "..");
const DEBUG_DIR = path.resolve(CLI_DIR, "../..", ".debug");
const BUNDLE = path.join(CLI_DIR, "build", "bw.js");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const NO_BUILD = process.env.NO_BUILD === "1" || process.env.NO_BUILD === "true";
// Built by `npm run build-native` in apps/desktop; the CLI spawns it to reach the desktop app.
const DEBUG_PROXY = path.resolve(CLI_DIR, "../desktop/desktop_native/target/debug/desktop_proxy");

const environment = {
  ...process.env,
  BITWARDENCLI_APPDATA_DIR: path.join(DEBUG_DIR, "cli-profile"),
  BITWARDEN_IPC_SOCKET_DIR: DEBUG_DIR,
};

// Prefer the checkout's proxy so the CLI matches the desktop build under test. Without it the CLI
// falls back to the installed app, which listens on a different socket dir.
if (fs.existsSync(DEBUG_PROXY)) {
  environment.BITWARDEN_DESKTOP_PROXY_PATH = DEBUG_PROXY;
}

fs.mkdirSync(environment.BITWARDENCLI_APPDATA_DIR, { recursive: true });

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: CLI_DIR,
    env: environment,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

// Rebuild so the run never silently uses a stale bundle. NO_BUILD trades that guarantee for a
// fast start, when the bundle is known to be current.
if (!NO_BUILD) {
  const buildStatus = run(NPM, ["run", "build:oss"]);
  if (buildStatus !== 0) {
    process.exit(buildStatus);
  }
} else if (!fs.existsSync(BUNDLE)) {
  throw new Error(`NO_BUILD is set but ${BUNDLE} does not exist. Run without NO_BUILD once.`);
}

process.exit(run(process.execPath, [BUNDLE, ...args]));
