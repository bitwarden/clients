import { ipcMain } from "electron";

import { chromium_importer } from "@bitwarden/desktop-napi";

export class ChromiumImporterService {
  constructor() {
    ipcMain.handle("chromium_importer.getMetadata", async (event) => {
      return await chromium_importer.getMetadata();
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
