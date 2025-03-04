import { mergeMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { BrowserApi } from "../browser/browser-api";

const IPC_CONTENT_SCRIPT_ID = "ipc-content-script";

export class IpcContentScriptManagerService {
  constructor(configService: ConfigService) {
    if (!BrowserApi.isManifestVersion(3)) {
      // IPC not supported on MV2
      return;
    }

    configService
      .getFeatureFlag$(FeatureFlag.IpcChannelFramework)
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
              matches: ["https://*/*"],
              js: ["content/ipc-content-script.js"],
            },
          ]);
        }),
      )
      .subscribe();
  }
}
