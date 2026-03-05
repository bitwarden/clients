// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, concatMap, filter } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  CommandDefinition,
  MessageListener,
  MessageSender,
  isExternalMessage,
} from "@bitwarden/common/platform/messaging";
import { SyncOptions } from "@bitwarden/common/platform/sync/sync.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { DO_FULL_SYNC } from "./foreground-sync.service";

export type FullSyncFinishedMessage = {
  successfully: boolean;
  errorMessage: string;
  requestId: string;
};

export const FULL_SYNC_FINISHED = new CommandDefinition<FullSyncFinishedMessage>(
  "fullSyncFinished",
);

export class SyncServiceListener {
  constructor(
    private readonly syncService: SyncService,
    private readonly messageListener: MessageListener,
    private readonly messageSender: MessageSender,
    private readonly logService: LogService,
  ) {}

  listener$(): Observable<void> {
    return this.messageListener.messages$(DO_FULL_SYNC).pipe(
      filter((message) => isExternalMessage(message)),
      concatMap(async ({ forceSync, options, requestId }) => {
        await this.doFullSync(forceSync, options, requestId);
      }),
    );
  }

  private async doFullSync(forceSync: boolean, options: SyncOptions, requestId: string) {
    try {
      const result = await this.syncService.fullSync(forceSync, options);
      this.messageSender.send(FULL_SYNC_FINISHED, {
        successfully: result,
        errorMessage: null,
        requestId,
      });
    } catch (err) {
      this.logService.warning("Error while doing full sync in SyncServiceListener", err);
      this.messageSender.send(FULL_SYNC_FINISHED, {
        successfully: false,
        errorMessage: err?.message ?? "Unknown Sync Error",
        requestId,
      });
    }
  }
}
