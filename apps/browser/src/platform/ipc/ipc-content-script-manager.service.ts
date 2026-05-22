import { BrowserApi } from "../browser/browser-api";

const IPC_CONTENT_SCRIPT_ID = "ipc-content-script";
const IPC_CONTENT_SCRIPT_FILE = "content/ipc-content-script.js";

export class IpcContentScriptManagerService {
  async init() {
    if (!BrowserApi.isManifestVersion(3)) {
      // IPC not supported on MV2
      return;
    }

    try {
      await BrowserApi.unregisterContentScriptsMv3({ ids: [IPC_CONTENT_SCRIPT_ID] });
    } catch {
      // Ignore errors
    }

    await BrowserApi.registerContentScriptsMv3([
      {
        id: IPC_CONTENT_SCRIPT_ID,
        // WARNING: This means that all websites can talk to the IPC layer.
        // Before sharing unlock state, this needs to be fixed.
        matches: ["https://*/*"],
        js: [IPC_CONTENT_SCRIPT_FILE],
      },
    ]);

    // The registration above only covers future navigations. Already-open tabs are still
    // running the previous extension context's content script, whose chrome.runtime handle
    // is now invalidated. Re-inject so they get a fresh instance bound to this context.
    await this.injectIntoOpenTabs();
  }

  private async injectIntoOpenTabs() {
    const tabs = await BrowserApi.tabsQuery({});

    await Promise.all(
      tabs.map(async (tab) => {
        if (tab.id == null || !tab.url?.startsWith("https://")) {
          return;
        }

        try {
          await BrowserApi.executeScriptInTab(tab.id, { file: IPC_CONTENT_SCRIPT_FILE });
        } catch {
          // Some tabs reject injection (discarded, restricted origins, etc.).
        }
      }),
    );
  }
}
