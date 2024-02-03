import { Observable } from "rxjs";

import {
  SyncCipherNotification,
  SyncFolderNotification,
  SyncSendNotification,
} from "../../../models/response/notification.response";
import { SyncEventArgs } from "../../types/sync-event-args";

export abstract class SyncService {
  syncInProgress: boolean;

  /**
   * Observable that emits when a full sync event occurs. This includes when a sync starts, completes, or fails.
   * @see SyncEventArgs
   */
  syncEvent$: Observable<SyncEventArgs>;

  /**
   * The last full sync event that occurred, will be null if no full sync event has occurred
   * @see SyncEventArgs
   */
  lastSyncEvent$: Observable<SyncEventArgs | null>;

  getLastSync: () => Promise<Date>;
  setLastSync: (date: Date, userId?: string) => Promise<any>;
  fullSync: (forceSync: boolean, allowThrowOnError?: boolean) => Promise<boolean>;
  syncUpsertFolder: (notification: SyncFolderNotification, isEdit: boolean) => Promise<boolean>;
  syncDeleteFolder: (notification: SyncFolderNotification) => Promise<boolean>;
  syncUpsertCipher: (notification: SyncCipherNotification, isEdit: boolean) => Promise<boolean>;
  syncDeleteCipher: (notification: SyncFolderNotification) => Promise<boolean>;
  syncUpsertSend: (notification: SyncSendNotification, isEdit: boolean) => Promise<boolean>;
  syncDeleteSend: (notification: SyncSendNotification) => Promise<boolean>;
}
