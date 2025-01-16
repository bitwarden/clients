import { filter, firstValueFrom, of, timeout } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import {
  CommandDefinition,
  MessageListener,
  MessageSender,
} from "@bitwarden/common/platform/messaging";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider } from "@bitwarden/common/platform/state";
import { CoreSyncService } from "@bitwarden/common/platform/sync/internal";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { InternalSendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";

import { FULL_SYNC_FINISHED } from "./sync-service.listener";

export type FullSyncMessage = { forceSync: boolean; allowThrowOnError: boolean; requestId: string };

export const DO_FULL_SYNC = new CommandDefinition<FullSyncMessage>("doFullSync");

export class ForegroundSyncService extends CoreSyncService {
  constructor(
    stateService: StateService,
    folderService: InternalFolderService,
    folderApiService: FolderApiServiceAbstraction,
    messageSender: MessageSender,
    logService: LogService,
    cipherService: CipherService,
    collectionService: CollectionService,
    apiService: ApiService,
    accountService: AccountService,
    authService: AuthService,
    sendService: InternalSendService,
    sendApiService: SendApiService,
    private readonly messageListener: MessageListener,
    stateProvider: StateProvider,
  ) {
    super(
      stateService,
      folderService,
      folderApiService,
      messageSender,
      logService,
      cipherService,
      collectionService,
      apiService,
      accountService,
      authService,
      sendService,
      sendApiService,
      stateProvider,
    );
  }

  async fullSync(forceSync: boolean, allowThrowOnError: boolean = false): Promise<boolean> {
    this.syncInProgress = true;
    try {
      const requestId = Utils.newGuid();
      const syncCompletedPromise = firstValueFrom(
        this.messageListener.messages$(FULL_SYNC_FINISHED).pipe(
          filter((m) => m.requestId === requestId),
          timeout({
            first: 30_000,
            // If we haven't heard back in 30 seconds, just pretend we heard back about an unsuccesful sync.
            with: () => {
              this.logService.warning(
                "ForegroundSyncService did not receive a message back in a reasonable time.",
              );
              return of({ successfully: false, errorMessage: "Sync timed out." });
            },
          }),
        ),
      );
      this.messageSender.send(DO_FULL_SYNC, { forceSync, allowThrowOnError, requestId });
      const result = await syncCompletedPromise;

      if (allowThrowOnError && result.errorMessage != null) {
        throw new Error(result.errorMessage);
      }

      return result.successfully;
    } finally {
      this.syncInProgress = false;
    }
  }
}
