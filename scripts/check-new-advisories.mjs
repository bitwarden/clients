// Fails only on RustSec advisories that the current tree introduces compared to
// a base commit, for example a new dependency or a version bump into a
// vulnerable range.
//
// `cargo deny check advisories` on its own fails whenever any locked crate has
// an advisory, including advisories published after the lockfile last changed.
// That makes it unsuitable as a required check: an unrelated PR can't fix it.
// This check runs cargo-deny against both the base commit and the current tree,
// with the same advisory database snapshot and the current tree's deny.toml,
// and reports only the findings that the base doesn't have. Findings are
// matched on advisory ID and crate name, not version, so moving between two
// versions that are both affected by the same advisory is not reported.
//
// The base commit comes from RUST_ADVISORIES_BASE, or defaults to the merge
// base with origin/HEAD. CI sets it to HEAD^1: a pull_request checkout is the
// merge commit, whose first parent is the tip of the target branch.
//
// Run it through `node scripts/lint-rust.mjs --only new-advisories`, which
// checks for cargo-run-bin and runs the cargo-binstall guard (VULN-613) before
// calling checkNewAdvisories().

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DESKTOP_NATIVE = resolve(REPO_ROOT, "apps/desktop/desktop_native");
const DESKTOP_NATIVE_REL = relative(REPO_ROOT, DESKTOP_NATIVE);

function git(args) {
  const res = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed:\n${res.stderr}`);
  }
  return res.stdout.trim();
}

function resolveBase() {
  const requested = process.env.RUST_ADVISORIES_BASE;
  if (requested) {
    return git(["rev-parse", "--verify", `${requested}^{commit}`]);
  }
  return git(["merge-base", "HEAD", "origin/HEAD"]);
}

// Run cargo from the current tree's workspace so its rust-toolchain.toml and
// pinned cargo-deny are used for both trees.
function cargo(args, { capture = false } = {}) {
  const res = spawnSync("cargo", args, {
    cwd: DESKTOP_NATIVE,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (res.error) {
    throw new Error(`Failed to run cargo: ${res.error.message}`);
  }
  return res;
}

// Returns a Map of finding key -> description for the workspace at
// `manifestPath`. Runs offline, so the advisory database and crates must
// already be fetched.
function advisoryFindings(manifestPath) {
  const res = cargo(
    [
      "bin",
      "cargo-deny",
      "--log-level",
      "error",
      "--format",
      "json",
      "--offline",
      "--all-features",
      "--manifest-path",
      manifestPath,
      "--config",
      join(DESKTOP_NATIVE, "deny.toml"),
      "check",
      "advisories",
    ],
    { capture: true },
  );

  const findings = new Map();
  for (const line of res.stderr.split("\n")) {
    if (!line.startsWith("{")) {
      continue;
    }
    const entry = JSON.parse(line);
    if (entry.type !== "diagnostic" || entry.fields?.severity !== "error") {
      continue;
    }
    const { advisory, code, graphs = [], message } = entry.fields;
    for (const { Krate: krate } of graphs) {
      // Advisory-backed findings (vulnerability, unmaintained, unsound) are
      // matched by ID and crate. Others, such as yanked crates, have no ID and
      // are matched by exact version.
      const key = advisory
        ? `${advisory.id}:${krate.name}`
        : `${code}:${krate.name}@${krate.version}`;
      const title = advisory ? `${advisory.id} ${advisory.title}` : message;
      findings.set(key, `${krate.name} ${krate.version}: ${title}`);
    }
  }

  // cargo-deny exits non-zero both for findings and for real failures, such as
  // a manifest it can't resolve. Only the first case produces diagnostics.
  if (res.status !== 0 && findings.size === 0) {
    throw new Error(`cargo-deny failed for ${manifestPath}:\n${res.stderr}`);
  }
  return findings;
}

export function checkNewAdvisories() {
  const base = resolveBase();
  const baseTree = mkdtempSync(join(tmpdir(), "rust-advisories-base-"));
  git(["worktree", "add", "--detach", baseTree, base]);

  try {
    const headManifest = join(DESKTOP_NATIVE, "Cargo.toml");
    const baseManifest = join(baseTree, DESKTOP_NATIVE_REL, "Cargo.toml");
    const baseHasWorkspace = existsSync(baseManifest);

    // Fetch everything up front so both cargo-deny runs below can run offline
    // and therefore read the same advisory database snapshot.
    if (cargo(["bin", "cargo-deny", "fetch", "db"]).status !== 0) {
      throw new Error("cargo-deny fetch db failed");
    }
    for (const manifest of baseHasWorkspace ? [headManifest, baseManifest] : [headManifest]) {
      if (cargo(["fetch", "--locked", "--manifest-path", manifest]).status !== 0) {
        throw new Error(`cargo fetch failed for ${manifest}`);
      }
    }

    const headFindings = advisoryFindings(headManifest);
    const baseFindings = baseHasWorkspace ? advisoryFindings(baseManifest) : new Map();

    const introduced = [...headFindings].filter(([key]) => !baseFindings.has(key));
    const preExisting = headFindings.size - introduced.length;

    console.log(`Compared against base ${base}.`);
    if (preExisting > 0) {
      console.log(
        `${preExisting} advisory finding(s) also exist on the base and are not reported here. ` +
          "See `lint-rust.mjs --only advisories`.",
      );
    }
    if (introduced.length === 0) {
      console.log("No new advisory findings.");
      return true;
    }
    console.error(`${introduced.length} new advisory finding(s) compared to the base:`);
    for (const [, description] of introduced) {
      console.error(`  ${description}`);
    }
    return false;
  } finally {
    git(["worktree", "remove", "--force", baseTree]);
    rmSync(baseTree, { recursive: true, force: true });
  }
}
