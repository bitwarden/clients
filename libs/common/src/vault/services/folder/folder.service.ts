// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  Observable,
  Subject,
  firstValueFrom,
  map,
  shareReplay,
  switchMap,
  merge,
  filter,
  combineLatest,
} from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { Utils } from "../../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { InternalFolderService as InternalFolderServiceAbstraction } from "../../../vault/abstractions/folder/folder.service.abstraction";
import { FolderData } from "../../../vault/models/data/folder.data";
import { Folder } from "../../../vault/models/domain/folder";
import { FolderView } from "../../../vault/models/view/folder.view";
import { Cipher } from "../../models/domain/cipher";
import { FolderWithIdRequest } from "../../models/request/folder-with-id.request";
import { FOLDER_DECRYPTED_FOLDERS, FOLDER_ENCRYPTED_FOLDERS } from "../key-state/folder.state";

export class FolderService implements InternalFolderServiceAbstraction {
  /**
   * Ensures we reuse the same observable stream for each userId rather than
   * creating a new one on each folderViews$ call.
   */
  private folderViewCache = new Map<UserId, Observable<FolderView[]>>();

  /**
   * Used to force the folderviews$ Observable to re-emit with a provided value.
   * Required because shareReplay with refCount: false maintains last emission.
   * Used during cleanup to force emit empty arrays, ensuring stale data isn't retained.
   */
  private forceFolderViews: Record<UserId, Subject<FolderView[]>> = {};

  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private i18nService: I18nService,
    private cipherService: CipherService,
    private stateProvider: StateProvider,
  ) {}

  folders$(userId: UserId): Observable<Folder[]> {
    return this.encryptedFoldersState(userId).state$.pipe(
      map((folders) => {
        if (folders == null) {
          return [];
        }

        return Object.values(folders).map((f) => new Folder(f));
      }),
    );
  }

  /**
   * Returns an Observable of decrypted folder views for the given userId.
   * Uses folderViewCache to maintain a single Observable instance per user,
   * combining normal folder state updates with forced updates.
   */
  folderViews$(userId: UserId): Observable<FolderView[]> {
    if (!this.folderViewCache.has(userId)) {
      if (!this.forceFolderViews[userId]) {
        this.forceFolderViews[userId] = new Subject<FolderView[]>();
      }

      const observable = merge(
        this.forceFolderViews[userId],
        combineLatest([
          this.encryptedFoldersState(userId).state$,
          this.keyService.userKey$(userId),
        ]).pipe(
          filter(([folderData, userKey]) => folderData != null && userKey != null),
          switchMap(([folderData, _]) => {
            return this.decryptFolders(userId, folderData);
          }),
        ),
      ).pipe(shareReplay({ refCount: false, bufferSize: 1 }));

      this.folderViewCache.set(userId, observable);
    }

    return this.folderViewCache.get(userId);
  }

  // TODO: This should be moved to EncryptService or something
  async encrypt(model: FolderView, key: SymmetricCryptoKey): Promise<Folder> {
    const folder = new Folder();
    folder.id = model.id;
    folder.name = await this.encryptService.encryptString(model.name, key);
    return folder;
  }

  async get(id: string, userId: UserId): Promise<Folder> {
    const folders = await firstValueFrom(this.folders$(userId));

    return folders.find((folder) => folder.id === id);
  }

  getDecrypted$(id: string, userId: UserId): Observable<FolderView | undefined> {
    return this.folderViews$(userId).pipe(
      map((folders) => folders.find((folder) => folder.id === id)),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  async getAllFromState(userId: UserId): Promise<Folder[]> {
    return await firstValueFrom(this.folders$(userId));
  }

  /**
   * @deprecated For the CLI only
   * @param id id of the folder
   */
  async getFromState(id: string, userId: UserId): Promise<Folder> {
    const folder = await this.get(id, userId);
    if (!folder) {
      return null;
    }

    return folder;
  }

  /**
   * @deprecated Only use in CLI!
   */
  async getAllDecryptedFromState(userId: UserId): Promise<FolderView[]> {
    return await firstValueFrom(this.folderViews$(userId));
  }

  async upsert(folderData: FolderData | FolderData[], userId: UserId): Promise<void> {
    await this.clearDecryptedFolderState(userId);
    await this.encryptedFoldersState(userId).update((folders) => {
      if (folders == null) {
        folders = {};
      }

      if (folderData instanceof FolderData) {
        const f = folderData as FolderData;
        folders[f.id] = f;
      } else {
        (folderData as FolderData[]).forEach((f) => {
          folders[f.id] = f;
        });
      }

      return folders;
    });
  }

  async replace(folders: { [id: string]: FolderData }, userId: UserId): Promise<void> {
    if (!folders) {
      return;
    }
    await this.clearDecryptedFolderState(userId);
    await this.stateProvider.getUser(userId, FOLDER_ENCRYPTED_FOLDERS).update(() => {
      const newFolders: Record<string, FolderData> = { ...folders };
      return newFolders;
    });
  }

  async clearDecryptedFolderState(userId: UserId): Promise<void> {
    if (userId == null) {
      throw new Error("User ID is required.");
    }

    await this.setDecryptedFolders([], userId);
  }

  async clear(userId: UserId): Promise<void> {
    this.forceFolderViews[userId]?.next([]);

    await this.encryptedFoldersState(userId).update(() => ({}));
    await this.clearDecryptedFolderState(userId);
  }

  async delete(id: string | string[], userId: UserId): Promise<any> {
    await this.clearDecryptedFolderState(userId);
    await this.encryptedFoldersState(userId).update((folders) => {
      if (folders == null) {
        return;
      }

      const folderIdsToDelete = Array.isArray(id) ? id : [id];

      folderIdsToDelete.forEach((id) => {
        if (folders[id] != null) {
          delete folders[id];
        }
      });

      return folders;
    });

    // Items in a deleted folder are re-assigned to "No Folder"
    const ciphers = await this.cipherService.getAll(userId);
    if (ciphers != null) {
      const updates: Cipher[] = [];
      for (const cId in ciphers) {
        if (ciphers[cId].folderId === id) {
          ciphers[cId].folderId = null;
          updates.push(ciphers[cId]);
        }
      }
      if (updates.length > 0) {
        await this.cipherService.upsert(updates.map((c) => c.toCipherData()));
      }
    }
  }

  async getRotatedData(
    originalUserKey: UserKey,
    newUserKey: UserKey,
    userId: UserId,
  ): Promise<FolderWithIdRequest[]> {
    if (newUserKey == null) {
      throw new Error("New user key is required for rotation.");
    }

    let encryptedFolders: FolderWithIdRequest[] = [];
    const folders = await firstValueFrom(this.folderViews$(userId));
    if (!folders) {
      return encryptedFolders;
    }
    encryptedFolders = await Promise.all(
      folders.map(async (folder) => {
        const encryptedFolder = await this.encrypt(folder, newUserKey);
        return new FolderWithIdRequest(encryptedFolder);
      }),
    );
    return encryptedFolders;
  }

  /**
   * Decrypts the folders for a user.
   * @param userId the user id
   * @param folderData encrypted folders
   * @returns a list of decrypted folders
   */
  private async decryptFolders(
    userId: UserId,
    folderData: Record<string, FolderData>,
  ): Promise<FolderView[]> {
    // Check if the decrypted folders are already cached
    const decrypted = await firstValueFrom(
      this.stateProvider.getUser(userId, FOLDER_DECRYPTED_FOLDERS).state$,
    );
    if (decrypted?.length) {
      return decrypted;
    }

    if (folderData == null) {
      return [];
    }

    const folders = Object.values(folderData).map((f) => new Folder(f));
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (!userKey) {
      return [];
    }

    const decryptFolderPromises = folders.map(async (f) => {
      try {
        return await f.decryptWithKey(userKey, this.encryptService);
      } catch {
        return null;
      }
    });
    const decryptedFolders = (await Promise.all(decryptFolderPromises))
      .filter((p) => p !== null)
      .sort(Utils.getSortFunction(this.i18nService, "name"));

    const noneFolder = new FolderView();
    noneFolder.name = this.i18nService.t("noneFolder");
    decryptedFolders.push(noneFolder);

    // Cache the decrypted folders
    await this.setDecryptedFolders(decryptedFolders, userId);
    return decryptedFolders;
  }

  /**
   * @returns a SingleUserState for the encrypted folders.
   */
  private encryptedFoldersState(userId: UserId) {
    return this.stateProvider.getUser(userId, FOLDER_ENCRYPTED_FOLDERS);
  }

  /**
   * Sets the decrypted folders state for a user.
   * @param folders the decrypted folders
   * @param userId the user id
   */
  private async setDecryptedFolders(folders: FolderView[], userId: UserId): Promise<void> {
    await this.stateProvider.setUserState(FOLDER_DECRYPTED_FOLDERS, folders, userId);
  }
}
