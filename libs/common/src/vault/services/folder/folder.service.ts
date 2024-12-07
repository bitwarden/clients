import { Observable, firstValueFrom, map, shareReplay } from "rxjs";

import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";

import { KeyService } from "../../../../../key-management/src/abstractions/key.service";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { DerivedState, StateProvider } from "../../../platform/state";
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
    return this.decryptedFoldersState(userId).state$;
  }

  async clearDecryptedFolderState(userId: UserId): Promise<void> {
    if (userId == null) {
      throw new Error("User ID is required.");
    }

    await this.decryptedFoldersState(userId).forceValue([]);
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

    await this.stateProvider.getUser(userId, FOLDER_ENCRYPTED_FOLDERS).update(() => {
      const newFolders: Record<string, FolderData> = { ...folders };
      return newFolders;
    });
  }

  async clear(userId: UserId): Promise<void> {
    await this.encryptedFoldersState(userId).update(() => ({}));
    await this.decryptedFoldersState(userId).forceValue([]);
  }

  async delete(id: string | string[], userId: UserId): Promise<any> {
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
   * @returns a SingleUserState for the encrypted folders.
   */
  private encryptedFoldersState(userId: UserId) {
    return this.stateProvider.getUser(userId, FOLDER_ENCRYPTED_FOLDERS);
  }

  /**
   *
   * @returns a SingleUserState for the decrypted folders.
   */
  private decryptedFoldersState(userId: UserId): DerivedState<FolderView[]> {
    return this.stateProvider.getDerived(
      this.encryptedFoldersState(userId).combinedState$,
      FOLDER_DECRYPTED_FOLDERS,
      {
        encryptService: this.encryptService,
        i18nService: this.i18nService,
        keyService: this.keyService,
      },
    );
  }
}
