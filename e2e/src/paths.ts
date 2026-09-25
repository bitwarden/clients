import { resolve } from "node:path";

// Playwright transpiles these files to CommonJS, so `__dirname` is what resolves here.
const E2E_DIR = resolve(__dirname, "..");

export const REPO_ROOT = resolve(E2E_DIR, "..");
export const DEBUG_DIR = resolve(REPO_ROOT, ".debug");

/** Per-run scratch state, wiped by the suites that own it. */
export const E2E_STATE_DIR = resolve(DEBUG_DIR, "e2e");

export const BROWSER_BUILD_DIR = resolve(REPO_ROOT, "apps/browser/build");
export const DESKTOP_BUILD_DIR = resolve(REPO_ROOT, "apps/desktop/build");
