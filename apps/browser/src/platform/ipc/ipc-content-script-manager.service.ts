import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { BrowserApi } from "../browser/browser-api";

const IPC_CONTENT_SCRIPT_ID = "ipc-content-script";
const IPC_CONTENT_SCRIPT_FILE = "content/ipc-content-script.js";
const IPC_CONTENT_SCRIPT_MATCHES = ["https://*/*"];

export class IpcContentScriptManagerService {
  constructor(private readonly configService: ConfigService) {}

  async init() {
    if (!BrowserApi.isManifestVersion(3)) {
      // IPC not supported on MV2
      return;
    }

    const enabled = await this.configService.getFeatureFlag(
      FeatureFlag.ContentScriptIpcChannelFramework,
    );
    if (!enabled) {
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
    await this.reinjectIntoOpenTabs();
  }

  private async reinjectIntoOpenTabs() {
    const tabs = await BrowserApi.tabsQuery({ url: IPC_CONTENT_SCRIPT_MATCHES });
    for (const tab of tabs) {
      if (tab.id === undefined) {
        continue;
      }

      try {
        await BrowserApi.executeScriptInTab(tab.id, {
          file: IPC_CONTENT_SCRIPT_FILE,
          runAt: "document_start",
        });
      } catch {
        // Per-tab failures (closed tab, restricted URL, etc.) shouldn't abort
        // the rest of the re-injection pass.
      }
    }
  }
}
