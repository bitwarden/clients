import { ipcRenderer } from "electron";

import type { NativeImporterMetadata } from "@bitwarden/desktop-napi";

const chromiumImporter = {
  getMetadata: (): Promise<Record<string, NativeImporterMetadata>> =>
    ipcRenderer.invoke("chromium_importer.getMetadata"),
  getAvailableProfiles: (browser: string): Promise<any[]> =>
    ipcRenderer.invoke("chromium_importer.getAvailableProfiles", browser),
  importLogins: (browser: string, profileId: string): Promise<any[]> =>
    ipcRenderer.invoke("chromium_importer.importLogins", browser, profileId),
};

export default {
  chromiumImporter,
};
