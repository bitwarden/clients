/* eslint-disable no-console */
import { ipcMain } from "electron";

import { chromium_importer } from "@bitwarden/desktop-napi";

export class ChromiumImporterService {
  constructor() {
    ipcMain.handle("chromium_importer.getMetadata", async (event) => {
      return await chromium_importer.getMetadata();
    });

    // Used on Mac OS App Store builds to request permissions to browser entries outside the sandbox
    ipcMain.handle("chromium_importer.requestBrowserAccess", async (event, browser: string) => {
      console.log("[IPC] requestBrowserAccess handler called for:", browser);
      console.log("[IPC] chromium_importer keys:", Object.keys(chromium_importer));
      console.log(
        "[IPC] requestBrowserAccess exists?",
        typeof chromium_importer.requestBrowserAccess,
      );

      if (chromium_importer.requestBrowserAccess) {
        console.log("[IPC] Calling native requestBrowserAccess");
        return await chromium_importer.requestBrowserAccess(browser);
      }
      console.log("[IPC] requestBrowserAccess not found, returning no-op");
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
