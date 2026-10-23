import { rmSync } from "node:fs";
import { resolve } from "node:path";

import {
  ElectronApplication,
  Page,
  _electron,
  chromium,
  expect,
  test as base,
} from "@playwright/test";

import { pruneVideo, startTrace, stopTrace, videoDir } from "../artifacts";
import { DESKTOP_BUILD_DIR, E2E_STATE_DIR } from "../paths";
import { IS_DEV_SERVER } from "../server";

// The main process also talks to the local dev server, and its certificate is self-signed.
const TLS_ARGS = IS_DEV_SERVER ? ["--ignore-certificate-errors"] : [];

// Keeps the suite's vault, settings and logs away from a real installation's app data.
const APPDATA_DIR = resolve(E2E_STATE_DIR, "desktop-profile");
const IPC_SOCKET_DIR = E2E_STATE_DIR;

const WINDOW_TIMEOUT_MS = 60_000;

// Lets a test reach the renderer again after a process reload crashed it (WindowMain).
const REMOTE_DEBUGGING_PORT = 9719;
const DEVTOOLS_URL = "devtools://";

async function launch(
  extraArgs: string[],
  extraEnv: Record<string, string>,
  recordVideoDir: string,
): Promise<ElectronApplication> {
  rmSync(APPDATA_DIR, { recursive: true, force: true });

  return _electron.launch({
    args: [
      DESKTOP_BUILD_DIR,
      "--no-sandbox",
      `--remote-debugging-port=${REMOTE_DEBUGGING_PORT}`,
      ...TLS_ARGS,
      ...extraArgs,
    ],
    env: {
      ...process.env,
      BITWARDEN_APPDATA_DIR: APPDATA_DIR,
      BITWARDEN_IPC_SOCKET_DIR: IPC_SOCKET_DIR,
      NODE_ENV: "development",
      ...extraEnv,
    },
    recordVideo: { dir: recordVideoDir },
  });
}

/**
 * The app window's renderer after a process reload. The reload crashes the renderer before
 * reloading it, and Playwright never follows a crashed page, so reconnect over DevTools.
 */
export async function reloadedWindow(): Promise<Page> {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${REMOTE_DEBUGGING_PORT}`);
  let window: Page | undefined;

  await expect
    .poll(
      () => {
        window = browser
          .contexts()
          .flatMap((context) => context.pages())
          .find((page) => !page.url().startsWith(DEVTOOLS_URL));
        return window != null;
      },
      { timeout: WINDOW_TIMEOUT_MS, message: "The reloaded app window never appeared" },
    )
    .toBe(true);

  await window!.waitForLoadState("domcontentloaded");
  return window!;
}

export const test = base.extend<{
  /** Additional Electron command line switches, e.g. `--remote-debugging-port`. */
  extraArgs: string[];
  /** Additional environment for the Electron process, e.g. `USE_AUTOMATION_BIOMETRICS`. */
  extraEnv: Record<string, string>;
  app: ElectronApplication;
  window: Page;
}>({
  extraArgs: [[], { option: true }],
  extraEnv: [{}, { option: true }],
  app: async ({ extraArgs, extraEnv }, use, testInfo) => {
    const app = await launch(extraArgs, extraEnv, videoDir(testInfo));
    await startTrace(app.context());

    await use(app);

    await stopTrace(app.context(), testInfo);
    await app.close();
    pruneVideo(testInfo);
  },
  window: async ({ app }, use) => {
    const window = await app.firstWindow({ timeout: WINDOW_TIMEOUT_MS });
    await window.waitForLoadState("domcontentloaded");

    await use(window);
  },
});

export { expect } from "@playwright/test";
