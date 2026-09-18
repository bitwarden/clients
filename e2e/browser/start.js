/* eslint-disable @typescript-eslint/no-require-imports */

////
// Wipes the debug Chrome profile, then builds the extension and launches it in
// Chrome for Testing (`npm run debug:browser`), which opens the remote debugging
// port the tests attach to. Used as Playwright's `webServer` command, so every
// run starts from a fresh, logged-out extension.
////

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const rimraf = require("rimraf");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEBUG_PROFILE_DIR = path.join(REPO_ROOT, ".debug", "chrome-profile");

rimraf.sync(DEBUG_PROFILE_DIR);

// The app's own build and run output would drown the test output, so it goes to
// a log file instead. The path is printed once, for when a run needs diagnosing.
const LOG_PATH = path.join(REPO_ROOT, ".debug", "e2e-browser.log");
const log = fs.openSync(LOG_PATH, "w");

console.log(`browser log: ${LOG_PATH}`);

const child = spawn("npm", ["run", "debug:browser"], {
  cwd: REPO_ROOT,
  stdio: ["ignore", log, log],
});

child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
