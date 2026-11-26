import { tmpdir } from "node:os";
import { resolve } from "node:path";

// Playwright transpiles these files to CommonJS, so `__dirname` is what resolves here.
const E2E_DIR = resolve(__dirname, "..");

export const REPO_ROOT = resolve(E2E_DIR, "..");
export const DEBUG_DIR = resolve(REPO_ROOT, ".debug");

export const E2E_STATE_DIR = resolve(DEBUG_DIR, "e2e");
export const CHROME_PROFILE_DIR = resolve(E2E_STATE_DIR, "chrome-profile");
/**
 * The control socket the fake native messaging host connects back to; see src/shared/fake-host.ts.
 *
 * Under the temporary directory rather than beside the other state: a unix socket path cannot
 * exceed 104 characters on macOS, and a checkout nested in a worktree already spends most of
 * that. One per worker, since each runs its own control server.
 */
export const PROXY_CONTROL_SOCKET = resolve(
  tmpdir(),
  `bw-e2e-proxy-${process.env.TEST_PARALLEL_INDEX ?? 0}.sock`,
);
export const FAKE_NATIVE_HOST = resolve(E2E_DIR, "src/shared/fake-native-host.mjs");

export const BROWSER_BUILD_DIR = resolve(REPO_ROOT, "apps/browser/build");
export const DESKTOP_BUILD_DIR = resolve(REPO_ROOT, "apps/desktop/build");
