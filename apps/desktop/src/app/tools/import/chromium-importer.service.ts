import { ipcMain } from "electron";

import { chromium_importer } from "@bitwarden/desktop-napi";

import { isMacAppStore } from "../../../utils";

export class ChromiumImporterService {
  constructor() {
    ipcMain.handle("chromium_importer.getMetadata", async (event, isMas: boolean) => {
      return await chromium_importer.getMetadata(isMas);
    });

    // Used on Mac OS App Store builds to request permissions to browser entries outside the sandbox
    ipcMain.handle("chromium_importer.requestBrowserAccess", async (event, browser: string) => {
      return await chromium_importer.requestBrowserAccess(browser, isMacAppStore());
    });

    ipcMain.handle("chromium_importer.getAvailableProfiles", async (event, browser: string) => {
      return await chromium_importer.getAvailableProfiles(browser, isMacAppStore());
    });

    ipcMain.handle(
      "chromium_importer.importLogins",
      async (event, browser: string, profileId: string) => {
        return await chromium_importer.importLogins(browser, profileId, isMacAppStore());
      },
    );
  }
}
