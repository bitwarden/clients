import { Observable, firstValueFrom, map, shareReplay } from "rxjs";

import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { Utils } from "../../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { ActiveUserState, DerivedState, StateProvider } from "../../../platform/state";
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
  folders$: Observable<Folder[]>;
  folderViews$: Observable<FolderView[]>;

  private encryptedFoldersState: ActiveUserState<Record<string, FolderData>>;
  private decryptedFoldersState: DerivedState<FolderView[]>;

  constructor(
    private cryptoService: CryptoService,
    private i18nService: I18nService,
    private cipherService: CipherService,
    private stateProvider: StateProvider,
  ) {
    this.encryptedFoldersState = this.stateProvider.getActive(FOLDER_ENCRYPTED_FOLDERS);
    this.decryptedFoldersState = this.stateProvider.getDerived(
      this.encryptedFoldersState.state$,
      FOLDER_DECRYPTED_FOLDERS,
      { folderService: this, cryptoService: this.cryptoService },
    );

    this.folders$ = this.encryptedFoldersState.state$.pipe(
      map((folderData) => Object.values(folderData).map((f) => new Folder(f))),
    );

    this.folderViews$ = this.decryptedFoldersState.state$;
  }

  async clearCache(): Promise<void> {
    await this.decryptedFoldersState.forceValue([]);
  }

  // TODO: This should be moved to EncryptService or something
  async encrypt(model: FolderView, key?: SymmetricCryptoKey): Promise<Folder> {
    const folder = new Folder();
    folder.id = model.id;
    folder.name = await this.cryptoService.encrypt(model.name, key);
    return folder;
  }

  async get(id: string): Promise<Folder> {
    const folders = await firstValueFrom(this.folders$);

    return folders.find((folder) => folder.id === id);
  }

  getDecrypted$(id: string): Observable<FolderView | undefined> {
    return this.folderViews$.pipe(
      map((folders) => folders.find((folder) => folder.id === id)),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  async getAllFromState(): Promise<Folder[]> {
    return await firstValueFrom(this.folders$);
  }

  /**
   * @deprecated For the CLI only
   * @param id id of the folder
   */
  async getFromState(id: string): Promise<Folder> {
    const folder = await this.get(id);
    if (!folder) {
      return null;
    }

    return folder;
  }

  /**
   * @deprecated Only use in CLI!
   */
  async getAllDecryptedFromState(): Promise<FolderView[]> {
    return await firstValueFrom(this.folderViews$);
  }

  async upsert(folderData: FolderData | FolderData[]): Promise<void> {
    await this.encryptedFoldersState.update((folders) => {
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

  async replace(folders: { [id: string]: FolderData }): Promise<void> {
    if (!folders) {
      return;
    }

    await this.encryptedFoldersState.update(() => {
      const newFolders: Record<string, FolderData> = { ...folders };
      return newFolders;
    });
  }

  async clear(userId?: UserId): Promise<void> {
    if (userId == null) {
      await this.encryptedFoldersState.update(() => ({}));
      await this.decryptedFoldersState.forceValue([]);
    } else {
      await this.stateProvider.getUser(userId, FOLDER_ENCRYPTED_FOLDERS).update(() => ({}));
    }
  }

  async delete(id: string | string[]): Promise<any> {
    await this.encryptedFoldersState.update((folders) => {
      if (folders == null) {
        return;
      }

      if (typeof id === "string") {
        if (folders[id] == null) {
          return;
        }
        delete folders[id];
      } else {
        (id as string[]).forEach((i) => {
          delete folders[i];
        });
      }
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
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.cipherService.upsert(updates.map((c) => c.toCipherData()));
      }
    }
  }

  async decryptFolders(folders: Folder[]) {
    const decryptFolderPromises = folders.map((f) => f.decrypt());
    const decryptedFolders = await Promise.all(decryptFolderPromises);

    decryptedFolders.sort(Utils.getSortFunction(this.i18nService, "name"));

    const noneFolder = new FolderView();
    noneFolder.name = this.i18nService.t("noneFolder");
    decryptedFolders.push(noneFolder);
    return decryptedFolders;
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
    const folders = await firstValueFrom(this.folderViews$);
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
}
