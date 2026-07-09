/// Launches Chrome for Testing with the unpacked extension loaded.

/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn, spawnSync } = require("child_process");
const { existsSync } = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const browsersDir = path.join(root, ".debug", "browsers");
const extensionDir = path.join(root, "apps", "browser", "build");

if (!existsSync(extensionDir)) {
  console.error(
    `Extension build not found at ${extensionDir}\nRun: cd apps/browser && npm run build:dev`,
  );
  process.exit(1);
}

// Ensure Chrome for Testing is installed under .debug/browsers/.
spawnSync("npx", ["@puppeteer/browsers", "install", "chrome@stable", "--path", browsersDir], {
  stdio: "inherit",
});
if (install.status !== 0) {
  console.error("Failed to install Chrome for Testing");
  process.exit(install.status ?? 1);
}

// Launch Chrome with the unpacked extension loaded.
const proc = spawn(
  "npx",
  [
    "@puppeteer/browsers",
    "launch",
    "chrome@stable",
    "--path",
    browsersDir,
    "--",
    // Note: This parameter is only supported on chrome for testing, not regular Chrome.
    `--load-extension=${extensionDir}`,
    "https://localhost:8080",
  ],
  { stdio: "inherit" },
);

proc.on("exit", (code) => process.exit(code ?? 0));
