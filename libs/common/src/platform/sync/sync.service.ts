import { Observable } from "rxjs";

import {
  SyncCipherNotification,
  SyncFolderNotification,
  SyncSendNotification,
} from "../../models/response/notification.response";
import { UserId } from "../../types/guid";

/**
 * A set of options for configuring how a {@link SyncService.fullSync} call should behave.
 */
export type SyncOptions = {
  /**
   * A boolean dictating whether or not caught errors should be rethrown.
   * `true` if they can be rethrown, `false` if they should not be rethrown.
   * @default false
   */
  allowThrowOnError?: boolean;
  /**
   * A boolean dictating whether or not to do a token refresh before doing the sync.
   * `true` if the refresh can be skipped, likely because one was done soon before the call to
   * `fullSync`. `false` if the token refresh should be done before getting data.
   *
   * @default false
   */
  skipTokenRefresh?: boolean;
};

/**
 * A class encapsulating sync operations and data.
 */
export abstract class SyncService {
  /**
   * A boolean indicating if a sync is currently in progress via this instance and this instance only.
   *
   * @deprecated Trusting this property is not safe as it only tells if the current instance is currently
   * doing a sync operation but does not tell if another instance of SyncService is doing a sync operation.
   */
  abstract syncInProgress: boolean;

  /**
   * Gets the date of the last sync for the currently active user.
   *
   * @returns The date of the last sync or null if there is no active user or the active user has not synced before.
   *
   * @deprecated Use {@link lastSync$} to get an observable stream of a given users last sync date instead.
   */
  abstract getLastSync(): Promise<Date | null>;

  /**
   * Retrieves a stream of the given users last sync date. Or null if the user has not synced before.
   * @param userId The user id of the user to get the stream for.
   */
  abstract lastSync$(userId: UserId): Observable<Date | null>;

  /**
   * Retrieves a stream of the currently active user's last sync date.
   * Or null if there is no current active user or the active user has not synced before.
   */
  abstract activeUserLastSync$(): Observable<Date | null>;

  /**
   * Optionally does a full sync operation including going to the server to gather the source
   * of truth and set that data to state.
   * @param forceSync A boolean dictating if a sync should be forced. If `true` a sync will happen
   * as long as the current user is authenticated. If `false` it will only sync if either a sync
   * has not happened before or the last sync date for the active user is before their account
   * revision date. Try to always use `false` if possible.
   * @param syncOptions Options for customizing how the sync call should behave.
   */
  abstract fullSync(forceSync: boolean, syncOptions?: SyncOptions): Promise<boolean>;

  /**
   * @deprecated Use the overload taking {@link SyncOptions} instead.
   */
  abstract fullSync(forceSync: boolean, allowThrowOnError?: boolean): Promise<boolean>;

  abstract syncUpsertFolder(
    notification: SyncFolderNotification,
    isEdit: boolean,
    userId: UserId,
  ): Promise<boolean>;
  abstract syncDeleteFolder(notification: SyncFolderNotification, userId: UserId): Promise<boolean>;
  abstract syncUpsertCipher(
    notification: SyncCipherNotification,
    isEdit: boolean,
    userId: UserId,
  ): Promise<boolean>;
  abstract syncDeleteCipher(notification: SyncFolderNotification, userId: UserId): Promise<boolean>;
  abstract syncUpsertSend(notification: SyncSendNotification, isEdit: boolean): Promise<boolean>;
  abstract syncDeleteSend(notification: SyncSendNotification): Promise<boolean>;
}
