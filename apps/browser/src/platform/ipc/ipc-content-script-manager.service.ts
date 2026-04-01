import { mergeMap, of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { BrowserApi } from "../browser/browser-api";

const IPC_CONTENT_SCRIPT_ID = "ipc-content-script";

export class IpcContentScriptManagerService {
  constructor(configService: ConfigService) {
    if (!BrowserApi.isManifestVersion(3)) {
      // IPC not supported on MV2
      return;
    }

    of(true)
      .pipe(
        mergeMap(async (enabled) => {
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
              // WARNING: This means that all websites can talk to the IPC layer.
              // Before sharing unlock state, this needs to be fixed.
              matches: ["https://*/*"],
              js: ["content/ipc-content-script.js"],
            },
          ]);
        }),
      )
      .subscribe();
  }
}
