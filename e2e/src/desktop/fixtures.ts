import { rmSync } from "node:fs";
import { resolve } from "node:path";

import { ElectronApplication, Page, _electron, test as base } from "@playwright/test";

import { DESKTOP_BUILD_DIR, E2E_STATE_DIR } from "../paths";

// Keeps the suite's vault, settings and logs away from a real installation's app data.
const APPDATA_DIR = resolve(E2E_STATE_DIR, "desktop-profile");
const IPC_SOCKET_DIR = E2E_STATE_DIR;

const WINDOW_TIMEOUT_MS = 60_000;

async function launch(): Promise<ElectronApplication> {
  rmSync(APPDATA_DIR, { recursive: true, force: true });

  return _electron.launch({
    // `--ignore-certificate-errors` is needed because the main process also talks to the
    // local dev server, and its certificate is self-signed.
    args: [DESKTOP_BUILD_DIR, "--no-sandbox", "--ignore-certificate-errors"],
    env: {
      ...process.env,
      BITWARDEN_APPDATA_DIR: APPDATA_DIR,
      BITWARDEN_IPC_SOCKET_DIR: IPC_SOCKET_DIR,
      NODE_ENV: "development",
    },
  });
}

export const test = base.extend<{ app: ElectronApplication; window: Page }>({
  app: async ({}, use) => {
    const app = await launch();
    await use(app);
    await app.close();
  },
  window: async ({ app }, use) => {
    const window = await app.firstWindow({ timeout: WINDOW_TIMEOUT_MS });
    await window.waitForLoadState("domcontentloaded");

    await use(window);
  },
});

export { expect } from "@playwright/test";
