import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import * as dotenv from "dotenv";

import { resolveBuildTarget } from "./build-targets";

const repoRoot = path.resolve(__dirname, "../../../..");
const testDir = path.resolve(__dirname, "..");

// Layer env files lowest-to-highest: `.env` then `.env.${ENV}`. Real shell/CI vars always win.
function loadEnv(): void {
  const parse = (file: string): Record<string, string> => {
    const p = path.resolve(testDir, file);
    return fs.existsSync(p) ? dotenv.parse(fs.readFileSync(p)) : {};
  };
  const base = parse(".env");
  const env = process.env.ENV ?? base.ENV ?? "development";
  for (const [key, value] of Object.entries({ ...base, ...parse(`.env.${env}`) })) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  // The self-hosted dev server uses a self-signed cert; let Node reach it without failing TLS.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

/** Comma-separated Nx build configurations to build and run. Defaults to "chrome-dev". */
export function targets(): string[] {
  return (process.env.TARGETS ?? "chrome-dev")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Playwright `globalSetup`: builds the unpacked extension for each target with the existing Nx build
 * configurations before the tests run. Nothing here mutates the build config. Skip with
 * `SKIP_BUILD=true` when building separately; a build failure aborts the run.
 */
export default function globalSetup(): void {
  loadEnv();
  if (process.env.SKIP_BUILD === "true") {
    return;
  }

  // Nx derives the webpack mode from each configuration; drop NODE_ENV/ENV so the surrounding shell
  // doesn't force it to an invalid mode.
  const buildEnv = { ...process.env };
  delete buildEnv.NODE_ENV;
  delete buildEnv.ENV;

  for (const target of targets()) {
    resolveBuildTarget(target); // validate the target name up front
    try {
      execFileSync("npx", ["nx", "build", "browser", `--configuration=${target}`], {
        cwd: repoRoot,
        stdio: "inherit",
        env: buildEnv,
      });
    } catch {
      process.stderr.write(`\nExtension build failed for "${target}"; aborting.\n`);
      process.exit(1);
    }
  }
}
