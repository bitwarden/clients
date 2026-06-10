#!/usr/bin/env node

// Unified lint/format runner for the Bitwarden desktop_native workspace.
// Mirrors the checks in .github/workflows/lint.yml so local runs match CI.
//
// Usage:
//   node scripts/lint-rust.mjs                Run every check (check-only).
//   node scripts/lint-rust.mjs --fix          Auto-fix where supported; still run check-only tools.
//   node scripts/lint-rust.mjs --only <name>  Run a single check. Composes with --fix.
//
// Available checks: fmt clippy sort udeps deny

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { checkNoBinstall } from "./check-no-binstall.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CWD = resolve(__dirname, "../apps/desktop/desktop_native");

const CHECKS = ["fmt", "clippy", "sort", "udeps", "deny"];

let fix = false;
let only = "";
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "--fix") {
    fix = true;
  } else if (arg === "--only") {
    only = argv[++i] ?? "";
  } else if (arg.startsWith("--only=")) {
    only = arg.slice("--only=".length);
  } else if (arg === "-h" || arg === "--help") {
    printHelp();
    process.exit(0);
  } else {
    console.error(`Unknown argument: ${arg}`);
    process.exit(2);
  }
}

if (only && !CHECKS.includes(only)) {
  console.error(`Unknown check: ${only}`);
  console.error(`Available: ${CHECKS.join(" ")}`);
  process.exit(2);
}

function printHelp() {
  console.log(`Unified lint/format runner for the Bitwarden desktop_native workspace.
Mirrors the checks in .github/workflows/lint.yml so local runs match CI.

Usage:
  node scripts/lint-rust.mjs                Run every check (check-only).
  node scripts/lint-rust.mjs --fix          Auto-fix where supported; still run check-only tools.
  node scripts/lint-rust.mjs --only <name>  Run a single check. Composes with --fix.

Available checks: ${CHECKS.join(" ")}`);
}

function section(name) {
  process.stdout.write(`\n\x1b[1;34m==> ${name}\x1b[0m\n`);
}

// Run a command in the workspace, inheriting stdio. Exits the process on failure.
function run(cmd, args, extraEnv = {}) {
  const res = spawnSync(cmd, args, {
    cwd: CWD,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (res.error) {
    console.error(`Failed to run ${cmd}: ${res.error.message}`);
    process.exit(1);
  }
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

// Tools run via cargo-run-bin (sort, udeps, deny) need the `cargo bin` runner and
// must not fall through to cargo-binstall. Source installs only; see VULN-613.
function requireCargoBin() {
  const probe = spawnSync("cargo", ["bin", "--version"], { stdio: "ignore" });
  if (probe.error || probe.status !== 0) {
    console.error("Required tool not found: cargo bin (cargo-run-bin)");
    console.error("Install with: cargo install cargo-run-bin --locked");
    console.error(
      "(Binary tool versions are pinned in Cargo.toml under [workspace.metadata.bin].)",
    );
    process.exit(1);
  }
  if (!checkNoBinstall()) {
    process.exit(1);
  }
}

const runners = {
  fmt() {
    run("cargo", ["+nightly", "fmt", ...(fix ? [] : ["--check"])]);
  },
  clippy() {
    // Pass `-D warnings` via RUSTFLAGS scoped to this command only (matching CI),
    // rather than exporting it globally, so it does not leak into the from-source
    // tool builds that `cargo bin` triggers for the other checks.
    const args = fix
      ? ["clippy", "--fix", "--allow-dirty", "--allow-staged", "--all-features", "--tests"]
      : ["clippy", "--all-features", "--tests"];
    run("cargo", args, { RUSTFLAGS: "-D warnings" });
  },
  sort() {
    requireCargoBin();
    run("cargo", ["bin", "cargo-sort", "--workspace", ...(fix ? [] : ["--check"])]);
  },
  udeps() {
    requireCargoBin();
    run("cargo", [
      "+nightly",
      "bin",
      "cargo-udeps",
      "--workspace",
      "--all-features",
      "--all-targets",
    ]);
  },
  deny() {
    requireCargoBin();
    run("cargo", ["bin", "cargo-deny", "--log-level", "error", "--all-features", "check", "all"]);
  },
};

for (const check of CHECKS) {
  if (only && only !== check) {
    continue;
  }
  section(check);
  runners[check]();
}
