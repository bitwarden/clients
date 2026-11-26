import { resolve } from "node:path";

// Playwright transpiles these files to CommonJS, so `__dirname` is what resolves here.
const E2E_DIR = resolve(__dirname, "..");

export const REPO_ROOT = resolve(E2E_DIR, "..");
export const DEBUG_DIR = resolve(REPO_ROOT, ".debug");

export const E2E_STATE_DIR = resolve(DEBUG_DIR, "e2e");
export const CHROME_PROFILE_DIR = resolve(E2E_STATE_DIR, "chrome-profile");
export const CLI_PROFILE_DIR = resolve(E2E_STATE_DIR, "cli-profile");

export const BROWSER_BUILD_DIR = resolve(REPO_ROOT, "apps/browser/build");
export const DESKTOP_BUILD_DIR = resolve(REPO_ROOT, "apps/desktop/build");
/** `npm run build:oss` in apps/cli. */
export const CLI_ENTRY = resolve(REPO_ROOT, "apps/cli/build/bw.js");
/** The dev proxy NativeMessagingMain spawns, which the CLI has to be pointed at explicitly. */
export const DESKTOP_PROXY = resolve(
  REPO_ROOT,
  "apps/desktop/desktop_native/target/debug/desktop_proxy",
);
