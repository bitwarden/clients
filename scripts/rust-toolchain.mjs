#!/usr/bin/env node

// Single source of truth for the Rust toolchains used by desktop_native. Both
// values live in apps/desktop/desktop_native/rust-toolchain.toml:
//
//   channel         - the stable toolchain (standard rust-toolchain.toml field,
//                     so `cargo` in that workspace honours it automatically)
//   nightly-channel - the nightly toolchain used by the checks that need it
//                     (fmt, udeps). Not part of the rust-toolchain.toml format;
//                     it exists so Renovate can manage the nightly date.
//
// Both keys are updated by the shared Renovate preset this repo extends
// (github>bitwarden/renovate-config), which matches them in any
// rust-toolchain.toml. Nothing else should hardcode either value -- CI reads
// them from here so a Renovate bump can't leave a workflow literal behind.
//
// The equivalent in bitwarden/sdk-internal is a `grep -oP` in each workflow,
// which we can't reuse: our Rust lint matrix includes macos-14, whose BSD grep
// has no -P.
//
// Usage:
//   node scripts/rust-toolchain.mjs             Print the stable channel.
//   node scripts/rust-toolchain.mjs --nightly   Print the nightly channel.
//
// Also importable as { stableToolchain, nightlyToolchain }.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLCHAIN_FILE = resolve(__dirname, "../apps/desktop/desktop_native/rust-toolchain.toml");

// Anchored at line start so `channel` cannot also match `nightly-channel`.
const PATTERNS = {
  stable: /^channel\s*=\s*"([^"]+)"/m,
  nightly: /^nightly-channel\s*=\s*"([^"]+)"/m,
};

function read(key) {
  const match = PATTERNS[key].exec(readFileSync(TOOLCHAIN_FILE, "utf8"));
  if (!match) {
    throw new Error(
      `Could not find a '${key === "stable" ? "channel" : "nightly-channel"}' entry in ${TOOLCHAIN_FILE}`,
    );
  }
  return match[1];
}

export const stableToolchain = () => read("stable");
export const nightlyToolchain = () => read("nightly");

// Run standalone when invoked directly. argv[1] is undefined under `node -e`,
// where nothing was invoked directly, so guard before resolving it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(process.argv.includes("--nightly") ? nightlyToolchain() : stableToolchain());
}
