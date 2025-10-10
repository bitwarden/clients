import { ipcMain } from "electron";

import { chromium_importer_metadata } from "@bitwarden/desktop-napi";

export class ChromiumImporterMetadataService {
  constructor() {
    ipcMain.handle("chromium_importer_metadata.getMetadataAsJson", async (event) => {
      return await chromium_importer_metadata.getMetadataAsJson();
    });
  }
}
