import { firstValueFrom, map, Observable, shareReplay, switchMap, tap, timer } from "rxjs";

import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { KeyService } from "../../../../../key-management/src/abstractions/key.service";
import { I18nService } from "../../../platform/abstractions/i18n.service";
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

let folderViewCount = 0;

export class FolderService implements InternalFolderServiceAbstraction {
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

  folderViews$(userId: UserId): Observable<FolderView[]> {
    const folderViewId = folderViewCount++;
    console.log(`FolderView$ ${folderViewId} created`);
    return this.encryptedFoldersState(userId).state$.pipe(
      switchMap((folderData) => {
        // RACE CONDITION HACK, DO NOT MERGE:
        // Add artificial delay to let encryptedFoldersState finish updating, the switchMap will cancel the previous observable
        // encryptedFoldersState has a shareReplay subject internally, so the old state is still available immediately after update.
        // By adding the timer(0), we are effectively skipping the "stale" emission.

        // A slightly better fix would be to cache these `folderView$` observables and return the same one for the same user.
        // That way we can put a shareReplay on this observable which prevents future subscribers from starting a
        // new subscription to encryptedFoldersState and getting stale value.
        return timer(0).pipe(
          tap(() => {
            console.log(`FolderView$ ${folderViewId} emitting`);
          }),
          switchMap(() => this.decryptFolders(userId, folderData)),
        );
      }),
    );
  }

  // TODO: This should be moved to EncryptService or something
  async encrypt(model: FolderView, key: SymmetricCryptoKey): Promise<Folder> {
    const folder = new Folder();
    folder.id = model.id;
    folder.name = await this.encryptService.encrypt(model.name, key);
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
    console.log("starting encryptedFoldersState update");
    await this.encryptedFoldersState(userId).update((folders) => {
      console.log("encryptedFoldersState update callback");
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
    console.log("ending encryptedFoldersState update");
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
    const ciphers = await this.cipherService.getAll();
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

    if (!folderData) {
      return [];
    }

    const folders = Object.values(folderData).map((f) => new Folder(f));
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (!userKey) {
      return [];
    }

    const decryptFolderPromises = folders.map((f) =>
      f.decryptWithKey(userKey, this.encryptService),
    );
    const decryptedFolders = await Promise.all(decryptFolderPromises);
    decryptedFolders.sort(Utils.getSortFunction(this.i18nService, "name"));

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
