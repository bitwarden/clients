import { ipcMain } from "electron";

import { chromium_importer } from "@bitwarden/desktop-napi";

export class ChromiumImporterService {
  constructor() {
    ipcMain.handle("chromium_importer.getMetadata", async (event) => {
      return await chromium_importer.getMetadata();
    });

    // Used on Mac OS App Store builds to request permissions to browser entries outside the sandbox
    ipcMain.handle("chromium_importer.requestBrowserAccess", async (event, browser: string) => {
      if (chromium_importer.requestBrowserAccess) {
        return await chromium_importer.requestBrowserAccess(browser);
      }
      // requestBrowserAccess not found, returning with no-op
      return;
    });

    ipcMain.handle("chromium_importer.getAvailableProfiles", async (event, browser: string) => {
      return await chromium_importer.getAvailableProfiles(browser);
    });

    ipcMain.handle(
      "chromium_importer.importLogins",
      async (event, browser: string, profileId: string) => {
        return await chromium_importer.importLogins(browser, profileId);
      },
    );
  }
}
