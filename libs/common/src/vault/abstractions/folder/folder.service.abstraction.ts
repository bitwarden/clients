import { Observable } from "rxjs";

import { UserKeyRotationDataProvider } from "@bitwarden/key-management";

import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { FolderData } from "../../models/data/folder.data";
import { Folder } from "../../models/domain/folder";
import { FolderWithIdRequest } from "../../models/request/folder-with-id.request";
import { FolderView } from "../../models/view/folder.view";

export abstract class FolderService implements UserKeyRotationDataProvider<FolderWithIdRequest> {
  folders$: (userId$: Observable<UserId>) => Observable<Folder[]>;
  folderViews$: (userId$: Observable<UserId>) => Observable<FolderView[]>;

  clearDecryptedFolderState: (userId: UserId) => Promise<void>;
  encrypt: (model: FolderView, key: SymmetricCryptoKey) => Promise<Folder>;
  get: (id: string, userId$: Observable<UserId>) => Promise<Folder>;
  getDecrypted$: (id: string, userId$: Observable<UserId>) => Observable<FolderView | undefined>;
  getAllFromState: (userId$: Observable<UserId>) => Promise<Folder[]>;
  /**
   * @deprecated Only use in CLI!
   */
  getFromState: (id: string, userId$: Observable<UserId>) => Promise<Folder>;
  /**
   * @deprecated Only use in CLI!
   */
  getAllDecryptedFromState: (userId$: Observable<UserId>) => Promise<FolderView[]>;
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
  upsert: (folder: FolderData | FolderData[], userId: UserId) => Promise<void>;
  replace: (folders: { [id: string]: FolderData }, userId: UserId) => Promise<void>;
  clear: (userId: UserId) => Promise<void>;
  delete: (id: string | string[], userId: UserId) => Promise<any>;
}
