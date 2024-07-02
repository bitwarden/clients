import { Observable } from "rxjs";

import { UserKeyRotationDataProvider } from "@bitwarden/auth/common";

import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { FolderData } from "../../models/data/folder.data";
import { Folder } from "../../models/domain/folder";
import { FolderWithIdRequest } from "../../models/request/folder-with-id.request";
import { FolderView } from "../../models/view/folder.view";

export abstract class FolderService implements UserKeyRotationDataProvider<FolderWithIdRequest> {
  folders$: Observable<Folder[]>;
  folderViews$: Observable<FolderView[]>;

  clearCache: () => Promise<void>;
  encrypt: (model: FolderView, key?: SymmetricCryptoKey) => Promise<Folder>;
  get: (id: string) => Promise<Folder>;
  getDecrypted$: (id: string) => Observable<FolderView>;
  getAllFromState: () => Promise<Folder[]>;
  /**
   * @deprecated Only use in CLI!
   */
  getFromState: (id: string) => Promise<Folder>;
  /**
   * @deprecated Only use in CLI!
   */
  getAllDecryptedFromState: () => Promise<FolderView[]>;
  decryptFolders: (folders: Folder[]) => Promise<FolderView[]>;
  /**
   * Returns user folders re-encrypted with the new user key.
   * @param originalUserKey the original user key
   * @param newUserKey the new user key
   * @param userId the user id
   * @throws Error if new user key is null
   * @returns a list of user folders that have been re-encrypted with the new user key
   */
  getRotatedData: (
    originalUserKey: UserKey,
    newUserKey: UserKey,
    userId: UserId,
  ) => Promise<FolderWithIdRequest[]>;
}

export abstract class InternalFolderService extends FolderService {
  upsert: (folder: FolderData | FolderData[]) => Promise<void>;
  replace: (folders: { [id: string]: FolderData }) => Promise<void>;
  clear: (userId: string) => Promise<any>;
  delete: (id: string | string[]) => Promise<any>;
}
