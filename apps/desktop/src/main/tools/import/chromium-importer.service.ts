import { ipcMain } from "electron";

import { chromium_importer } from "@bitwarden/desktop-napi";

import { isMacAppStore } from "../../../utils";

export class ChromiumImporterService {
  constructor() {
    ipcMain.handle("chromium_importer.getMetadata", async () => {
      return await chromium_importer.getMetadata(isMacAppStore());
    });

    // Used on Mac OS App Store builds to request permissions to browser entries outside the sandbox
    ipcMain.handle(
      "chromium_importer.requestBrowserAccess",
      async (_event, browser: string, pickerStrings: chromium_importer.PickerStrings) => {
        return await chromium_importer.requestBrowserAccess(
          browser,
          pickerStrings,
          isMacAppStore(),
        );
      },
    );

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
