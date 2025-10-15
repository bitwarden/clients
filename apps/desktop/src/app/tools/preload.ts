import { ipcRenderer } from "electron";

import { NativeImporter } from "./import/desktop-import-metadata.service";

const chromiumImporter = {
  getMetadata: (): Promise<Record<string, NativeImporter>> =>
    ipcRenderer.invoke("chromium_importer.getMetadata"),
  getInstalledBrowsers: (): Promise<string[]> =>
    ipcRenderer.invoke("chromium_importer.getInstalledBrowsers"),
  getAvailableProfiles: (browser: string): Promise<any[]> =>
    ipcRenderer.invoke("chromium_importer.getAvailableProfiles", browser),
  importLogins: (browser: string, profileId: string): Promise<any[]> =>
    ipcRenderer.invoke("chromium_importer.importLogins", browser, profileId),
};

export default {
  chromiumImporter,
};
