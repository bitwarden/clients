// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map, Observable, of, switchMap } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";

import { ApiService } from "../../abstractions/api.service";
import { AccountService } from "../../auth/abstractions/account.service";
import { AuthService } from "../../auth/abstractions/auth.service";
import { TokenService } from "../../auth/abstractions/token.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import {
  SyncCipherNotification,
  SyncFolderNotification,
  SyncSendNotification,
} from "../../models/response/notification.response";
import { SendData } from "../../tools/send/models/data/send.data";
import { SendApiService } from "../../tools/send/services/send-api.service.abstraction";
import { InternalSendService } from "../../tools/send/services/send.service.abstraction";
import { UserId } from "../../types/guid";
import { CipherService } from "../../vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "../../vault/abstractions/folder/folder-api.service.abstraction";
import { InternalFolderService } from "../../vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "../../vault/abstractions/sync/sync.service.abstraction";
import { CipherData } from "../../vault/models/data/cipher.data";
import { FolderData } from "../../vault/models/data/folder.data";
import { LogService } from "../abstractions/log.service";
import { MessageSender } from "../messaging";
import { StateProvider, SYNC_DISK, UserKeyDefinition } from "../state";

import { SyncOptions } from "./sync.service";

const LAST_SYNC_DATE = new UserKeyDefinition<Date>(SYNC_DISK, "lastSync", {
  deserializer: (d) => (d != null ? new Date(d) : null),
  clearOn: ["logout"],
});

/**
 * Core SyncService Logic EXCEPT for fullSync so that implementations can differ.
 */
export abstract class CoreSyncService implements SyncService {
  syncInProgress = false;

  constructor(
    readonly tokenService: TokenService,
    protected readonly folderService: InternalFolderService,
    protected readonly folderApiService: FolderApiServiceAbstraction,
    protected readonly messageSender: MessageSender,
    protected readonly logService: LogService,
    protected readonly cipherService: CipherService,
    protected readonly collectionService: CollectionService,
    protected readonly apiService: ApiService,
    protected readonly accountService: AccountService,
    protected readonly authService: AuthService,
    protected readonly sendService: InternalSendService,
    protected readonly sendApiService: SendApiService,
    protected readonly stateProvider: StateProvider,
  ) {}

  abstract fullSync(forceSync: boolean, syncOptions?: SyncOptions): Promise<boolean>;
  abstract fullSync(forceSync: boolean, allowThrowOnError?: boolean): Promise<boolean>;

  async getLastSync(): Promise<Date> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id)));
    if (userId == null) {
      return null;
    }

    return await firstValueFrom(this.lastSync$(userId));
  }

  lastSync$(userId: UserId) {
    return this.stateProvider.getUser(userId, LAST_SYNC_DATE).state$;
  }

  activeUserLastSync$(): Observable<Date | null> {
    return this.accountService.activeAccount$.pipe(
      switchMap((a) => {
        if (a == null) {
          return of(null);
        }
        return this.lastSync$(a.id);
      }),
    );
  }

  async setLastSync(date: Date, userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, LAST_SYNC_DATE).update(() => date);
  }

  async syncUpsertFolder(
    notification: SyncFolderNotification,
    isEdit: boolean,
    userId: UserId,
  ): Promise<boolean> {
    this.syncStarted();

    const authStatus = await firstValueFrom(this.authService.authStatusFor$(userId));

    if (authStatus >= AuthenticationStatus.Locked) {
      try {
        const localFolder = await this.folderService.get(notification.id, userId);
        if (
          (!isEdit && localFolder == null) ||
          (isEdit && localFolder != null && localFolder.revisionDate < notification.revisionDate)
        ) {
          const remoteFolder = await this.folderApiService.get(notification.id);
          if (remoteFolder != null) {
            await this.folderService.upsert(new FolderData(remoteFolder), userId);
            this.messageSender.send("syncedUpsertedFolder", { folderId: notification.id });
            return this.syncCompleted(true, userId);
          }
        }
      } catch (e) {
        this.logService.error(e);
      }
    }
    return this.syncCompleted(false, userId);
  }

  async syncDeleteFolder(notification: SyncFolderNotification, userId: UserId): Promise<boolean> {
    this.syncStarted();

    const authStatus = await firstValueFrom(this.authService.authStatusFor$(userId));

    if (authStatus >= AuthenticationStatus.Locked) {
      await this.folderService.delete(notification.id, userId);
      this.messageSender.send("syncedDeletedFolder", { folderId: notification.id });
      this.syncCompleted(true, userId);
      return true;
    }
    return this.syncCompleted(false, userId);
  }

  async syncUpsertCipher(
    notification: SyncCipherNotification,
    isEdit: boolean,
    userId: UserId,
  ): Promise<boolean> {
    this.syncStarted();

    const authStatus = await firstValueFrom(this.authService.authStatusFor$(userId));
    if (authStatus >= AuthenticationStatus.Locked) {
      try {
        let shouldUpdate = true;
        const localCipher = await this.cipherService.get(notification.id, userId);
        if (localCipher != null && localCipher.revisionDate >= notification.revisionDate) {
          shouldUpdate = false;
        }

        let checkCollections = false;
        if (shouldUpdate) {
          if (isEdit) {
            shouldUpdate = localCipher != null;
            checkCollections = true;
          } else {
            if (notification.collectionIds == null || notification.organizationId == null) {
              shouldUpdate = localCipher == null;
            } else {
              shouldUpdate = false;
              checkCollections = true;
            }
          }
        }

        if (
          !shouldUpdate &&
          checkCollections &&
          notification.organizationId != null &&
          notification.collectionIds != null &&
          notification.collectionIds.length > 0
        ) {
          const collections = await firstValueFrom(
            this.collectionService
              .encryptedCollections$(userId)
              .pipe(map((collections) => collections ?? [])),
          );
          if (collections != null) {
            for (let i = 0; i < collections.length; i++) {
              if (notification.collectionIds.indexOf(collections[i].id) > -1) {
                shouldUpdate = true;
                break;
              }
            }
          }
        }

        if (shouldUpdate) {
          const remoteCipher = await this.apiService.getFullCipherDetails(notification.id);
          if (remoteCipher != null) {
            await this.cipherService.upsert(new CipherData(remoteCipher));
            this.messageSender.send("syncedUpsertedCipher", { cipherId: notification.id });
            return this.syncCompleted(true, userId);
          }
        }
      } catch (e) {
        if (e != null && e.statusCode === 404 && isEdit) {
          await this.cipherService.delete(notification.id, userId);
          this.messageSender.send("syncedDeletedCipher", { cipherId: notification.id });
          return this.syncCompleted(true, userId);
        }
      }
    }
    return this.syncCompleted(false, userId);
  }

  async syncDeleteCipher(notification: SyncCipherNotification, userId: UserId): Promise<boolean> {
    this.syncStarted();

    const authStatus = await firstValueFrom(this.authService.authStatusFor$(userId));
    if (authStatus >= AuthenticationStatus.Locked) {
      await this.cipherService.delete(notification.id, userId);
      this.messageSender.send("syncedDeletedCipher", { cipherId: notification.id });
      return this.syncCompleted(true, userId);
    }
    return this.syncCompleted(false, userId);
  }

  async syncUpsertSend(notification: SyncSendNotification, isEdit: boolean): Promise<boolean> {
    this.syncStarted();
    const [activeUserId, status] = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        switchMap((a) => {
          if (a == null) {
            of([null, AuthenticationStatus.LoggedOut]);
          }
          return this.authService.authStatusFor$(a.id).pipe(map((s) => [a.id, s]));
        }),
      ),
    );
    // Process only server notifications for currently active user when user is not logged out
    // TODO: once send service allows data manipulation of non-active users, this should process any received notification
    if (activeUserId === notification.userId && status !== AuthenticationStatus.LoggedOut) {
      try {
        const localSend = await firstValueFrom(this.sendService.get$(notification.id));
        if (
          (!isEdit && localSend == null) ||
          (isEdit && localSend != null && localSend.revisionDate < notification.revisionDate)
        ) {
          const remoteSend = await this.sendApiService.getSend(notification.id);
          if (remoteSend != null) {
            await this.sendService.upsert(new SendData(remoteSend));
            this.messageSender.send("syncedUpsertedSend", { sendId: notification.id });
            return this.syncCompleted(true, activeUserId);
          }
        }
      } catch (e) {
        this.logService.error(e);
      }
    }
    // TODO: Update syncCompleted userId when send service allows modification of non-active users
    return this.syncCompleted(false, undefined);
  }

  async syncDeleteSend(notification: SyncSendNotification): Promise<boolean> {
    this.syncStarted();
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    if (
      activeUserId != null &&
      (await firstValueFrom(this.tokenService.hasAccessToken$(activeUserId)))
    ) {
      await this.sendService.delete(notification.id);
      this.messageSender.send("syncedDeletedSend", { sendId: notification.id });
      // TODO: Update syncCompleted userId when send service allows modification of non-active users
      this.syncCompleted(true, undefined);
      return true;
    }
    return this.syncCompleted(false, undefined);
  }

  // Helpers

  protected syncStarted() {
    this.syncInProgress = true;
    this.messageSender.send("syncStarted");
  }

  protected syncCompleted(successfully: boolean, userId: UserId | undefined): boolean {
    this.syncInProgress = false;
    this.messageSender.send("syncCompleted", { successfully: successfully, userId });
    return successfully;
  }
}
