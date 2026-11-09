#!/usr/bin/env node

// Runs an e2e npm script on the host, or, with BITWARDEN_E2E_ISOLATE_DOCKER set, inside a
// Linux container under Xvfb, so the suites' Chromium and Electron windows never take focus.
//
//   node e2e/docker/isolate.mjs <script> [args...]
//
//   host ──► npm run <script> -- args                      (variable unset)
//   host ──► docker run ─► entrypoint.sh ─► xvfb-run npm run <script> -- args
//
// The repo is bind-mounted, so builds and e2e/test-results/ land on the host. Directories
// holding platform-specific binaries (node_modules, the Rust target) are masked by named
// volumes, so the container never runs the host's macOS binaries, nor overwrites them.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ISOLATE_ENV = "BITWARDEN_E2E_ISOLATE_DOCKER";

const DOCKER_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(DOCKER_DIR, "../..");

const IMAGE = "bitwarden-e2e";
const VOLUME_PREFIX = "bitwarden-e2e";
const WORKSPACE = "/workspace";

// Caches living outside the repo; paths match the ENV in the Dockerfile. Only the
// downloaded parts of cargo, so the image's rustup and cargo binaries stay visible.
const CACHE_DIRS = ["/opt/rustup", "/opt/cargo/registry", "/opt/ms-playwright"];

// Profiles and the desktop IPC socket (e2e/src/paths.ts). Unix sockets are unreliable on
// macOS bind mounts, and it keeps the host's state apart.
const E2E_STATE_DIR = ".debug/e2e";
const RUST_TARGET_DIR = "apps/desktop/desktop_native/target";

// Where a TLS-intercepting proxy (e.g. endpoint protection) points tools at its CA bundle.
// The image trusts the first one found, and sets these to its own copy.
const CA_ENV = ["NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "CURL_CA_BUNDLE"];

// Host-specific variables; everything else reaches the container.
const DENIED_ENV = new Set([
  ISOLATE_ENV,
  ...CA_ENV,
  "CARGO_HTTP_CAINFO",
  "BUNDLE_SSL_CA_CERT",
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "PWD",
  "OLDPWD",
  "TMPDIR",
  "DISPLAY",
  "SSH_AUTH_SOCK",
  "INIT_CWD",
  "NODE",
]);
const DENIED_ENV_PREFIXES = [
  "npm_",
  "NVM_",
  "HOMEBREW_",
  "CARGO_",
  "RUSTUP_",
  "XPC_",
  "__CF",
  "TERM_PROGRAM",
];

const [script, ...args] = process.argv.slice(2);

if (script == null) {
  console.error("Usage: isolate.mjs <npm script> [args...]");
  process.exit(1);
}

process.exit(process.env[ISOLATE_ENV] ? runInDocker() : runOnHost());

function runOnHost() {
  return run("npm", ["run", script, "--", ...args]);
}

function runInDocker() {
  const build = run("docker", ["build", "-q", "-t", IMAGE, ...buildArgs(), DOCKER_DIR]);
  if (build !== 0) {
    return build;
  }

  return run("docker", [
    "run",
    "--rm",
    "--init",
    "--shm-size=2g",
    // Reaches the local server and dev server on the host's localhost, e.g. https://localhost:8080.
    "--network=host",
    ...ttyFlags(),
    "-v",
    `${REPO_ROOT}:${WORKSPACE}`,
    "-w",
    WORKSPACE,
    ...volumeFlags(),
    "--mount",
    `type=tmpfs,dst=${WORKSPACE}/${E2E_STATE_DIR}`,
    ...envFlags(),
    IMAGE,
    `${WORKSPACE}/e2e/docker/entrypoint.sh`,
    script,
    ...args,
  ]);
}

/** Pins the image to the repo's Node and Playwright versions. */
function buildArgs() {
  const nodeMajor = readFileSync(resolve(REPO_ROOT, ".nvmrc"), "utf8").trim().replace(/^v/, "");
  const e2ePackage = JSON.parse(readFileSync(resolve(REPO_ROOT, "e2e/package.json"), "utf8"));
  const playwright = e2ePackage.devDependencies["@playwright/test"];

  return [
    "--build-arg",
    `NODE_MAJOR=${nodeMajor}`,
    "--build-arg",
    `PLAYWRIGHT_VERSION=${playwright}`,
    ...caArgs(),
  ];
}

/** The host's CA bundle as a build secret, plus its hash, since secrets never bust the cache. */
function caArgs() {
  const bundle = CA_ENV.map((name) => process.env[name]).find((path) => path && existsSync(path));
  if (bundle == null) {
    return [];
  }

  const sha = createHash("sha256").update(readFileSync(bundle)).digest("hex");

  return ["--secret", `id=host_ca,src=${bundle}`, "--build-arg", `HOST_CA_SHA=${sha}`];
}

/** Interactive only when the host is, so Ctrl-C and colors work, and CI logs stay clean. */
function ttyFlags() {
  const flags = [];

  if (process.stdin.isTTY) {
    flags.push("-i");
  }
  if (process.stdout.isTTY) {
    flags.push("-t");
  }

  return flags;
}

/** One named volume per masked directory, e.g. `bitwarden-e2e-apps_desktop_node_modules`. */
function volumeFlags() {
  const repoDirs = [...nodeModulesDirs(), RUST_TARGET_DIR].map((dir) => `${WORKSPACE}/${dir}`);

  return [...repoDirs, ...CACHE_DIRS].flatMap((dir) => ["-v", `${volumeName(dir)}:${dir}`]);
}

function volumeName(dir) {
  const relative = dir.startsWith(`${WORKSPACE}/`) ? dir.slice(WORKSPACE.length + 1) : dir;

  return `${VOLUME_PREFIX}-${relative.replace(/^\//, "").replaceAll("/", "_")}`;
}

/**
 * The lockfile's install locations, e.g. `node_modules` and `apps/desktop/node_modules`,
 * plus every app's, where webpack keeps a cache full of host paths.
 */
function nodeModulesDirs() {
  const lock = JSON.parse(readFileSync(resolve(REPO_ROOT, "package-lock.json"), "utf8"));
  const dirs = new Set();

  for (const key of Object.keys(lock.packages)) {
    const match = /^(.*?node_modules)\//.exec(key);
    if (match) {
      dirs.add(match[1]);
    }
  }

  for (const app of readdirSync(resolve(REPO_ROOT, "apps"), { withFileTypes: true })) {
    if (app.isDirectory()) {
      dirs.add(`apps/${app.name}/node_modules`);
    }
  }

  return dirs;
}

/** `-e NAME` makes the docker CLI copy the value, keeping secrets out of the process list. */
function envFlags() {
  return Object.keys(process.env)
    .filter((name) => !DENIED_ENV.has(name))
    .filter((name) => !DENIED_ENV_PREFIXES.some((prefix) => name.startsWith(prefix)))
    .flatMap((name) => ["-e", name]);
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit", cwd: REPO_ROOT });

  if (result.error) {
    console.error(result.error.message);
    return 1;
  }

  return result.status ?? 1;
}
