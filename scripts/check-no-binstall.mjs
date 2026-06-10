#!/usr/bin/env node

// Verifies that cargo-run-bin will NOT use cargo-binstall to fetch tool binaries.
//
// cargo-run-bin uses binstall when EITHER:
//   1. A `binstall` alias is defined in .cargo/config.toml at the project root, OR
//   2. `cargo-binstall` is available on PATH.
//
// We require source installs from crates.io so the tools we run match the source
// we audit. See VULN-613 for the dependency review of cargo-run-bin and the
// explicit caveat against enabling binstall.
//
// Returns true if neither path would trigger binstall. A repo-defined binstall
// alias always fails. In CI (GITHUB_ACTIONS=true) `cargo-binstall` on PATH also
// fails; locally it only warns -- devs may have binstall installed on their own
// machines and we don't try to police that. When run directly, exits 1 on failure.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP_NATIVE = resolve(__dirname, "../apps/desktop/desktop_native");

function hasCommand(cmd) {
  try {
    if (process.platform === "win32") {
      execFileSync("where", [cmd], { stdio: "ignore" });
    } else {
      // `command -v` is a portable POSIX shell builtin.
      execFileSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

export function checkNoBinstall() {
  const config = resolve(DESKTOP_NATIVE, ".cargo/config.toml");
  let ok = true;

  // Match both inline form (`binstall = "..."`) and table form (`[alias.binstall]`).
  if (
    existsSync(config) &&
    /^\s*(binstall\s*=|\[alias\.binstall\])/m.test(readFileSync(config, "utf8"))
  ) {
    console.error("ERROR: .cargo/config.toml defines a 'binstall' alias.");
    console.error("       cargo-run-bin would use cargo-binstall to fetch pre-built tool binaries");
    console.error(
      "       from third-party mirrors (QuickInstall) instead of building from crates.io",
    );
    console.error("       sources. Remove the alias. See VULN-613 for context.");
    ok = false;
  }

  if (hasCommand("cargo-binstall")) {
    const msg =
      "cargo-binstall is on PATH; cargo-run-bin will use it to fetch pre-built tool binaries";
    if (process.env.GITHUB_ACTIONS === "true") {
      console.error(`ERROR: ${msg}.`);
      console.error(
        "       CI must build tools from source. Do not install cargo-binstall on the runner.",
      );
      console.error("       See VULN-613 for context.");
      ok = false;
    } else {
      console.error(`WARN: ${msg} (your local machine).`);
      console.error(
        "      CI builds tools from source, but your local 'cargo bin' invocations will use binstall.",
      );
    }
  }

  return ok;
}

// Run standalone (e.g. from CI) when invoked directly.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(checkNoBinstall() ? 0 : 1);
}
