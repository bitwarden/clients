import { Observable } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.

// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

import { UserId } from "../../../types/guid";
import { FolderData } from "../../models/data/folder.data";
import { Folder } from "../../models/domain/folder";
import { FolderView } from "../../models/view/folder.view";

export abstract class FolderService {
  abstract folders$(userId: UserId): Observable<Folder[]>;
  abstract folderViews$(userId: UserId): Observable<FolderView[]>;

  abstract clearDecryptedFolderState(userId: UserId): Promise<void>;
  abstract encrypt(model: FolderView, key: SymmetricCryptoKey): Promise<Folder>;
  abstract get(id: string, userId: UserId): Promise<Folder>;
  abstract getDecrypted$(id: string, userId: UserId): Observable<FolderView | undefined>;
  /**
   * @deprecated Use firstValueFrom(folders$) directly instead
   * @param userId The user id
   * @returns Promise of folders array
   */
  abstract getAllFromState(userId: UserId): Promise<Folder[]>;
  /**
   * @deprecated Only use in CLI!
   */
  abstract getFromState(id: string, userId: UserId): Promise<Folder>;
  /**
   * @deprecated Only use in CLI!
   */
  abstract getAllDecryptedFromState(userId: UserId): Promise<FolderView[]>;
}

export abstract class InternalFolderService extends FolderService {
  abstract upsert(folder: FolderData | FolderData[], userId: UserId): Promise<void>;
  abstract replace(folders: { [id: string]: FolderData }, userId: UserId): Promise<void>;
  abstract clear(userId: UserId): Promise<void>;
  abstract delete(id: string | string[], userId: UserId): Promise<any>;
}
