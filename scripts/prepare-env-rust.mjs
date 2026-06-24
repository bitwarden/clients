#!/usr/bin/env node

// Prepares the environment for developing in Rust for the clients repo,
// specifically Desktop Native. Used by both developers locally and in CI, on
// every platform (replaces the former prepare-env-unix-rust.sh / -windows-rust.ps1).
//
// It installs the toolchains and bootstraps cargo-run-bin. The individual binary
// cargo tools (cargo-deny, cargo-sort, cargo-udeps, etc.) are pinned in
// apps/desktop/desktop_native/Cargo.toml under [workspace.metadata.bin] and built
// lazily on first use via `cargo bin <tool>` (see scripts/lint-rust.mjs).

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Pinned bootstrap version of cargo-run-bin. Renovate-managed; keep in sync with
// the CI workflows and build.js.
const CARGO_RUN_BIN_VERSION = "1.7.4";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP_NATIVE = resolve(__dirname, "../apps/desktop/desktop_native");

// Run a command inheriting stdio; throws on failure.
function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

// Capture stdout of a command; returns "" on failure.
function capture(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return res.status === 0 && res.stdout ? res.stdout.trim() : "";
}

function hasCommand(cmd) {
  const probe = spawnSync(cmd, ["--version"], { stdio: "ignore" });
  return !probe.error && probe.status === 0;
}

async function installRustup() {
  if (hasCommand("rustup")) {
    return;
  }
  console.log("Installing Rust...");
  if (process.platform === "win32") {
    const arch = process.env.PROCESSOR_ARCHITECTURE === "ARM64" ? "aarch64" : "x86_64";
    const initPath = join(tmpdir(), "rustup-init.exe");
    const res = await fetch(`https://win.rustup.rs/${arch}`);
    if (!res.ok) {
      throw new Error(`Failed to download rustup-init.exe: ${res.status} ${res.statusText}`);
    }
    writeFileSync(initPath, Buffer.from(await res.arrayBuffer()));
    try {
      run(initPath, ["-y", "--default-toolchain", "stable"]);
    } finally {
      unlinkSync(initPath);
    }
  } else {
    // Pipe the rustup installer through the shell, matching the documented one-liner.
    const installer =
      "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable";
    const res = spawnSync(installer, { stdio: "inherit", shell: true });
    if (res.status !== 0) {
      throw new Error("rustup installation failed");
    }
  }
}

// Ensure the cargo bin directory is on PATH for this process (and its children).
function ensureCargoOnPath() {
  const cargoBin = join(process.env.CARGO_HOME || join(homedir(), ".cargo"), "bin");
  if (existsSync(cargoBin) && !(process.env.PATH || "").split(delimiter).includes(cargoBin)) {
    process.env.PATH = `${cargoBin}${delimiter}${process.env.PATH || ""}`;
  }
}

function installToolchains() {
  // Determine the desired toolchain (from rust-toolchain.toml) and ensure it's installed.
  let activeToolchain = capture("rustup", ["show", "active-toolchain"], { cwd: DESKTOP_NATIVE });
  // Keep only the first token (strip trailing parenthetical info).
  activeToolchain = activeToolchain.split(/\s+/)[0] || "";

  if (!activeToolchain) {
    // No active toolchain yet: fall back to env override or default to stable.
    activeToolchain = process.env.RUSTUP_TOOLCHAIN || "stable";
    run("rustup", ["default", activeToolchain]);
  }

  // For building desktop_native.
  run("rustup", ["toolchain", "install", activeToolchain]);
  // For the cargo tools used in pre-commit hooks and CI.
  run("rustup", ["toolchain", "install", "nightly"]);
  run("rustup", ["show"]);
  console.log();
}

// Bootstraps cargo-run-bin (the `cargo bin` runner) at the pinned version. The
// binary tools it runs are pinned in [workspace.metadata.bin] and built lazily.
function installCargoRunBin() {
  const version = capture("cargo", ["bin", "--version"]);
  if (version === `cargo-run-bin ${CARGO_RUN_BIN_VERSION}`) {
    console.log(`cargo-run-bin ${CARGO_RUN_BIN_VERSION} is already installed.`);
  } else {
    console.log(`cargo-run-bin ${CARGO_RUN_BIN_VERSION} is not installed. Installing ...`);
    run("cargo", ["install", "cargo-run-bin", "--locked", "--version", CARGO_RUN_BIN_VERSION]);
  }
}

await installRustup();
ensureCargoOnPath();
installToolchains();
installCargoRunBin();
