// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { ImportRecordError } from "./import-record-error";

export type FolderRelationship = [cipherIndex: number, folderIndex: number];
export type CollectionRelationship = [cipherIndex: number, collectionIndex: number];

export class ImportResult {
  success = false;
  errorMessage: string;
  ciphers: CipherView[] = [];
  folders: FolderView[] = [];
  folderRelationships: FolderRelationship[] = [];
  collections: CollectionView[] = [];
  collectionRelationships: CollectionRelationship[] = [];
  /**
   * Items that could not be imported and were skipped. When non-empty on a successful import, the
   * valid items were still imported; the UI/CLI surface these to the user.
   */
  errors: ImportRecordError[] = [];
}
