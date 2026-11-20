#!/usr/bin/env node

// Helper script for git pre-commit hooks only (via lint-staged).
// Not intended to be run directly.

import { execSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { nightlyToolchain } from "./rust-toolchain.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cwd = resolve(__dirname, "../apps/desktop/desktop_native");
const prepareScript = "node scripts/prepare-env-rust.mjs";

// Callers write `+nightly` for readability; resolve it to the pin in
// rust-toolchain.toml so pre-commit formatting matches CI. See lint-rust.mjs.
const args = process.argv
  .slice(2)
  .map((arg) => (arg === "+nightly" ? `+${nightlyToolchain()}` : arg))
  .join(" ");

try {
  execSync(`cargo ${args}`, { cwd, stdio: "inherit" });
} catch {
  console.error(
    `\nIf you are missing the required Rust tools, you can install them with ${prepareScript}\n`,
  );
  process.exit(1);
}
