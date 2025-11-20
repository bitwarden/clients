import { ipcRenderer } from "electron";

import type { chromium_importer } from "@bitwarden/desktop-napi";

const chromiumImporter = {
  getMetadata: (): Promise<Record<string, chromium_importer.NativeImporterMetadata>> =>
    ipcRenderer.invoke("chromium_importer.getMetadata"),
  // Request browser access for Mac OS App Store (sandboxed) builds (no-op in non-sandboxed builds)
  requestBrowserAccess: (browser: string): Promise<void> =>
    ipcRenderer.invoke("chromium_importer.requestBrowserAccess", browser),
  getAvailableProfiles: (browser: string): Promise<chromium_importer.ProfileInfo[]> =>
    ipcRenderer.invoke("chromium_importer.getAvailableProfiles", browser),
  importLogins: (
    browser: string,
    profileId: string,
  ): Promise<chromium_importer.LoginImportResult[]> =>
    ipcRenderer.invoke("chromium_importer.importLogins", browser, profileId),
};

export default {
  chromiumImporter,
};
