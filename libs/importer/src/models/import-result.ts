// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { ImportRecordError } from "./import-record-error";

export type FolderRelationship = [cipherIndex: number, folderIndex: number];
export type CollectionRelationship = [cipherIndex: number, collectionIndex: number];

/** Stable identifiers for errorMessage's cause, for callers that need to branch on it (e.g. a
 *  wrong file password) without matching against the localized message text. */
export const ImportResultErrorKey = Object.freeze({
  InvalidFilePassword: "invalidFilePassword",
  AccountMismatch: "importEncKeyError",
} as const);
export type ImportResultErrorKey = (typeof ImportResultErrorKey)[keyof typeof ImportResultErrorKey];

export class ImportResult {
  success = false;
  errorMessage: string;
  /** Optional: most importers' errorMessage has no caller that needs to distinguish its cause. */
  errorKey?: ImportResultErrorKey;
  ciphers: CipherView[] = [];
  folders: FolderView[] = [];
  folderRelationships: FolderRelationship[] = [];
  collections: CollectionView[] = [];
  collectionRelationships: CollectionRelationship[] = [];
  /** True when `folders[0]` is the pre-existing destination folder, not parsed from the source. */
  targetFolderIncluded = false;
  /** True when `collections[0]` is the pre-existing destination collection, not parsed from the source. */
  targetCollectionIncluded = false;
  /**
   * Items that could not be imported and were skipped. When non-empty on a successful import, the
   * valid items were still imported; the UI/CLI surface these to the user.
   */
  errors: ImportRecordError[] = [];
}

/** Thrown by ImportService when an ImportResult's success is false — carries errorKey alongside
 *  the localized message so a caller can branch on the cause without string-matching errorMessage. */
export class ImportResultError extends Error {
  constructor(
    message: string,
    readonly errorKey?: ImportResultErrorKey,
  ) {
    super(message);
    this.name = "ImportResultError";
  }
}
