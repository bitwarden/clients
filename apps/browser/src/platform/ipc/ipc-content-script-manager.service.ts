import { BrowserApi } from "../browser/browser-api";

const IPC_CONTENT_SCRIPT_ID = "ipc-content-script";
const IPC_CONTENT_SCRIPT_FILE = "content/ipc-content-script.js";
const IPC_CONTENT_SCRIPT_MATCHES = ["https://*/*"];

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
        matches: IPC_CONTENT_SCRIPT_MATCHES,
        js: [IPC_CONTENT_SCRIPT_FILE],
      },
    ]);

    // Registration only injects on future page loads. Tabs already open
    // when the (re)started service worker runs this code still hold a
    // content-script instance bound to the previous extension context
    // (its chrome.runtime is invalidated after `chrome.runtime.reload()`
    // on process reload). Re-inject so they get a fresh runtime handle;
    // the old instance tears itself down via its port's onDisconnect.
    //
    // Not awaited: the background bootstrap awaits `init()`, and the handlers that answer the
    // popup's lock and unlock requests are registered after it. One tab that never answers
    // `executeScript` would otherwise stall startup indefinitely.
    void this.reinjectIntoOpenTabs();
  }

  private async reinjectIntoOpenTabs() {
    try {
      const tabs = await BrowserApi.tabsQuery({ url: IPC_CONTENT_SCRIPT_MATCHES });
      for (const tab of tabs) {
        if (tab.id === undefined) {
          continue;
        }

        // Not awaited, so one unresponsive tab doesn't hold up the others.
        BrowserApi.executeScriptInTab(tab.id, {
          file: IPC_CONTENT_SCRIPT_FILE,
          runAt: "document_start",
        }).catch(() => {
          // Per-tab failures (closed tab, restricted URL, etc.) shouldn't abort
          // the rest of the re-injection pass.
        });
      }
    } catch {
      // Best effort. Tabs that miss the re-injection pick up the registered script on their next
      // load.
    }
  }
}
