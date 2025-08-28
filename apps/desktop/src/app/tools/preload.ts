import { ipcRenderer } from "electron";

const chromiumImporter = {
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
