import { combineLatest, map, mergeMap, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { UserId } from "@bitwarden/common/types/guid";

import { BrowserApi } from "../browser/browser-api";

const IPC_CONTENT_SCRIPT_ID = "ipc-content-script";

export class IpcContentScriptManagerService {
  constructor(accountService: AccountService, environmentService: EnvironmentService) {
    if (!BrowserApi.isManifestVersion(3)) {
      // IPC not supported on MV2
      return;
    }

    accountService.accounts$
      .pipe(
        map((accounts) => Object.keys(accounts) as UserId[]),
        switchMap((userIds) =>
          combineLatest(userIds.map((userId) => environmentService.getEnvironment$(userId))),
        ),
        mergeMap(async (environments) => {
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
