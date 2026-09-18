/* eslint-disable @typescript-eslint/no-require-imports */

////
// Wipes the debug app data dir, then starts the desktop app in debug mode with
// mocked biometrics. Used as Playwright's `webServer` command so every run starts
// from a fresh, logged-out app whose biometric prompts can be driven from tests.
////

const { spawn } = require("child_process");
const path = require("path");

const rimraf = require("rimraf");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEBUG_PROFILE_DIR = path.join(REPO_ROOT, ".debug", "desktop-profile");

rimraf.sync(DEBUG_PROFILE_DIR);

const child = spawn("npm", ["run", "debug:desktop:automation"], {
  cwd: REPO_ROOT,
  stdio: "inherit",
});

child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));

// debug-start.js reaps the Electron client and the watchers on these signals.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
