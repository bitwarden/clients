/* eslint-disable @typescript-eslint/no-require-imports */

////
// Starts the web vault's webpack dev server (`ENV=development`), which serves it
// over https on port 8080 and proxies /api, /identity and friends to the local
// server stack. Used as Playwright's `webServer` command.
////

const { spawn } = require("child_process");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const WEB_DIR = path.join(REPO_ROOT, "apps", "web");

const child = spawn("npm", ["run", "build:oss:watch"], {
  cwd: WEB_DIR,
  stdio: "inherit",
  env: { ...process.env, ENV: "development" },
});

child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
