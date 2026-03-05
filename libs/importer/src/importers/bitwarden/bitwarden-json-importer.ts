// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  CipherWithIdExport,
  CollectionWithIdExport,
  FolderWithIdExport,
} from "@bitwarden/common/models/export";
import {
  BitwardenJsonExport,
  BitwardenUnEncryptedIndividualJsonExport,
  BitwardenUnEncryptedJsonExport,
  BitwardenUnEncryptedOrgJsonExport,
  isOrgUnEncrypted,
  isUnencrypted,
} from "@bitwarden/vault-export-core";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

export class BitwardenJsonImporter extends BaseImporter implements Importer {
  protected constructor() {
    super();
  }

  async parse(data: string): Promise<ImportResult> {
    const results: BitwardenJsonExport = JSON.parse(data);
    if (results == null || results.items == null) {
      const result = new ImportResult();
      result.success = false;
      return result;
    }

    if (!isUnencrypted(results)) {
      throw new Error("Data is encrypted. Use BitwardenEncryptedJsonImporter instead.");
    }
    return await this.parseDecrypted(results);
  }

  private async parseDecrypted(results: BitwardenUnEncryptedJsonExport): Promise<ImportResult> {
    const importResult = new ImportResult();

    const groupingsMap = isOrgUnEncrypted(results)
      ? await this.parseCollections(results, importResult)
      : await this.parseFolders(results, importResult);

    results.items.forEach((c) => {
      const cipher = CipherWithIdExport.toView(c);
      // reset ids in case they were set for some reason
      cipher.id = null;
      cipher.organizationId = null;
      cipher.collectionIds = null;

      // make sure password history is limited
      if (cipher.passwordHistory != null && cipher.passwordHistory.length > 5) {
        cipher.passwordHistory = cipher.passwordHistory.slice(0, 5);
      }

      if (!this.organization && c.folderId != null && groupingsMap.has(c.folderId)) {
        importResult.folderRelationships.push([
          importResult.ciphers.length,
          groupingsMap.get(c.folderId),
        ]);
      } else if (this.organization && c.collectionIds != null) {
        c.collectionIds.forEach((cId) => {
          if (groupingsMap.has(cId)) {
            importResult.collectionRelationships.push([
              importResult.ciphers.length,
              groupingsMap.get(cId),
            ]);
          }
        });
      }

      this.cleanupCipher(cipher);
      importResult.ciphers.push(cipher);
    });

    importResult.success = true;
    return importResult;
  }

  private async parseFolders(
    data: BitwardenUnEncryptedIndividualJsonExport,
    importResult: ImportResult,
  ): Promise<Map<string, number>> {
    const groupingsMap = new Map<string, number>();
    if (data.folders == null) {
      return groupingsMap;
    }

    for (const f of data.folders) {
      const folderView = FolderWithIdExport.toView(f);
      if (folderView != null) {
        groupingsMap.set(f.id, importResult.folders.length);
        importResult.folders.push(folderView);
      }
    }
    return groupingsMap;
  }

  private async parseCollections(
    data: BitwardenUnEncryptedOrgJsonExport,
    importResult: ImportResult,
  ): Promise<Map<string, number>> {
    const groupingsMap = new Map<string, number>();
    if (data.collections == null) {
      return groupingsMap;
    }

    for (const c of data.collections) {
      const collectionView = CollectionWithIdExport.toView(c);
      collectionView.organizationId = null;

      if (collectionView != null) {
        groupingsMap.set(c.id, importResult.collections.length);
        importResult.collections.push(collectionView);
      }
    }
    return groupingsMap;
  }
}
