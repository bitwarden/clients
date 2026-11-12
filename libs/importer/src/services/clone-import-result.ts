import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { ImportResult } from "../models/import-result";

/**
 * If importing into a specific location fails, the user can re-try a different location.
 * The deep copy allows the same set of imported credentials having a different location.
 */
export function cloneImportResult(result: ImportResult): ImportResult {
  const copy = new ImportResult();
  copy.success = result.success;
  copy.errorMessage = result.errorMessage;
  copy.ciphers = result.ciphers.map((cipher) =>
    CipherView.fromJSON(JSON.parse(JSON.stringify(cipher))),
  ) as CipherView[];
  copy.folders = result.folders.map((folder) =>
    FolderView.fromJSON(JSON.parse(JSON.stringify(folder))),
  );
  copy.folderRelationships = result.folderRelationships.map(([cipher, folder]) => [cipher, folder]);
  copy.collections = result.collections.map((collection) =>
    CollectionView.fromJSON(JSON.parse(JSON.stringify(collection))),
  );
  copy.collectionRelationships = result.collectionRelationships.map(([cipher, collection]) => [
    cipher,
    collection,
  ]);
  copy.targetFolderIncluded = result.targetFolderIncluded;
  copy.targetCollectionIncluded = result.targetCollectionIncluded;
  copy.errors = [...result.errors];
  return copy;
}
