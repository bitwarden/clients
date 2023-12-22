import {
  SyncCipherNotification,
  SyncFolderNotification,
  SyncSendNotification,
} from "../../../models/response/notification.response";

export abstract class SyncService {
  syncInProgress: boolean;

  getLastSync: () => Promise<Date>;
  setLastSync: (date: Date, userId?: string) => Promise<any>;
  /**
   * Will cause a sync to happen if it's is forced to or the data on the server is likely different from the data stored locally.
   *
   * @param forceSync Whether or not to force a sync. If false, the users account is checked for it's revision date,
   * if that date is past the locally stored last sync time then no sync happens. If true, no checks for revision
   * date happens and a sync is forced.
   * @param purpose A kebab lowercased string that is relatively unique and descriptive to the reason the sync was requested.
   * @param allowThrowOnError An optional boolean dictating whether exceptions should be thrown or swallowed if they occur.
   * Default value is false.
   *
   * @returns Returns true if the sync happened or returns false if the sync did not happen or did not complete successfully.
   */
  fullSync: (
    forceSync: boolean,
    purpose: Lowercase<string>,
    allowThrowOnError?: boolean,
  ) => Promise<boolean>;
  syncUpsertFolder: (notification: SyncFolderNotification, isEdit: boolean) => Promise<boolean>;
  syncDeleteFolder: (notification: SyncFolderNotification) => Promise<boolean>;
  syncUpsertCipher: (notification: SyncCipherNotification, isEdit: boolean) => Promise<boolean>;
  syncDeleteCipher: (notification: SyncFolderNotification) => Promise<boolean>;
  syncUpsertSend: (notification: SyncSendNotification, isEdit: boolean) => Promise<boolean>;
  syncDeleteSend: (notification: SyncSendNotification) => Promise<boolean>;
}
