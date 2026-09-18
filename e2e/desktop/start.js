/* eslint-disable @typescript-eslint/no-require-imports */

////
// Wipes the debug app data dir, then starts the desktop app in debug mode with
// mocked biometrics. Used as Playwright's `webServer` command so every run starts
// from a fresh, logged-out app whose biometric prompts can be driven from tests.
////

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const rimraf = require("rimraf");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEBUG_PROFILE_DIR = path.join(REPO_ROOT, ".debug", "desktop-profile");

rimraf.sync(DEBUG_PROFILE_DIR);

// The app's own build and run output would drown the test output, so it goes to
// a log file instead. The path is printed once, for when a run needs diagnosing.
const LOG_PATH = path.join(REPO_ROOT, ".debug", "e2e-desktop.log");
const log = fs.openSync(LOG_PATH, "w");

console.log(`desktop log: ${LOG_PATH}`);

const child = spawn("npm", ["run", "debug:desktop:automation"], {
  cwd: REPO_ROOT,
  stdio: ["ignore", log, log],
});

child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));

// debug-start.js reaps the Electron client and the watchers on these signals.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
