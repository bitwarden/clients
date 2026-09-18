/* eslint-disable @typescript-eslint/no-require-imports */

////
// Starts the web vault's webpack dev server (`ENV=development`), which serves it
// over https on port 8080 and proxies /api, /identity and friends to the local
// server stack. Used as Playwright's `webServer` command.
//
// The bit build is used rather than the OSS one because the commercial features
// the tests cover -- SSO, trusted device encryption, key connector -- only exist
// there.
////

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const WEB_DIR = path.join(REPO_ROOT, "apps", "web");

// The dev server's build output would drown the test output, so it goes to a log
// file instead. The path is printed once, for when a run needs diagnosing.
const LOG_PATH = path.join(REPO_ROOT, ".debug", "e2e-web.log");
const log = fs.openSync(LOG_PATH, "w");

console.log(`web log: ${LOG_PATH}`);

const child = spawn("npm", ["run", "build:bit:watch"], {
  cwd: WEB_DIR,
  stdio: ["ignore", log, log],
  env: { ...process.env, ENV: "development" },
});

child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
