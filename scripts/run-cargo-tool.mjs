#!/usr/bin/env node

// Helper script for git pre-commit hooks only (via lint-staged).
// Not intended to be run directly.

import { execSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cwd = resolve(__dirname, "../apps/desktop/desktop_native");
const prepareScript =
  process.platform === "win32"
    ? "scripts/prepare-env-windows-rust.ps1"
    : "scripts/prepare-env-unix-rust.sh";

const args = process.argv.slice(2).join(" ");

try {
  execSync(`cargo ${args}`, { cwd, stdio: "inherit" });
} catch {
  console.error(
    `\nIf you are missing the required Rust tools, you can install them with ${prepareScript}\n`,
  );
  process.exit(1);
}
