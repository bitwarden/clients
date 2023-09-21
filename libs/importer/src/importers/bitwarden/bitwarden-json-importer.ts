import {
  CipherWithIdExport,
  CollectionWithIdExport,
  FolderWithIdExport,
} from "@bitwarden/common/models/export";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  BitwardenEncryptedIndividualJsonExport,
  BitwardenEncryptedOrgJsonExport,
  BitwardenJsonExport,
  BitwardenUnEncryptedIndividualJsonExport,
  BitwardenUnEncryptedOrgJsonExport,
} from "@bitwarden/exporter/vault-export/bitwarden-json-export-types";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

export class BitwardenJsonImporter extends BaseImporter implements Importer {
  private result: ImportResult;

  protected constructor(
    protected cryptoService: CryptoService,
    protected i18nService: I18nService
  ) {
    super();
  }

  async parse(data: string): Promise<ImportResult> {
    this.result = new ImportResult();
    const results: BitwardenJsonExport = JSON.parse(data);
    if (results == null || results.items == null) {
      this.result.success = false;
      return this.result;
    }

    if (results.encrypted) {
      await this.parseEncrypted(results as any);
    } else {
      await this.parseDecrypted(results as any);
    }

    return this.result;
  }

  private async parseEncrypted(
    results: BitwardenEncryptedIndividualJsonExport | BitwardenEncryptedOrgJsonExport
  ) {
    if (results.encKeyValidation_DO_NOT_EDIT != null) {
      const orgKey = await this.cryptoService.getOrgKey(this.organizationId);
      const encKeyValidation = new EncString(results.encKeyValidation_DO_NOT_EDIT);
      const encKeyValidationDecrypt = await this.cryptoService.decryptToUtf8(
        encKeyValidation,
        orgKey
      );
      if (encKeyValidationDecrypt === null) {
        this.result.success = false;
        this.result.errorMessage = this.i18nService.t("importEncKeyError");
        return;
      }
    }

    const groupingsMap = this.organization
      ? await this.parseCollections(results as BitwardenEncryptedOrgJsonExport)
      : await this.parseFolders(results as BitwardenEncryptedIndividualJsonExport);

    for (const c of results.items) {
      const cipher = CipherWithIdExport.toDomain(c);
      // reset ids incase they were set for some reason
      cipher.id = null;
      cipher.organizationId = this.organizationId;
      cipher.collectionIds = null;

      // make sure password history is limited
      if (cipher.passwordHistory != null && cipher.passwordHistory.length > 5) {
        cipher.passwordHistory = cipher.passwordHistory.slice(0, 5);
      }

      if (!this.organization && c.folderId != null && groupingsMap.has(c.folderId)) {
        this.result.folderRelationships.push([
          this.result.ciphers.length,
          groupingsMap.get(c.folderId),
        ]);
      } else if (this.organization && c.collectionIds != null) {
        c.collectionIds.forEach((cId) => {
          if (groupingsMap.has(cId)) {
            this.result.collectionRelationships.push([
              this.result.ciphers.length,
              groupingsMap.get(cId),
            ]);
          }
        });
      }

      const view = await cipher.decrypt();
      this.cleanupCipher(view);
      this.result.ciphers.push(view);
    }

    this.result.success = true;
  }

  private async parseDecrypted(
    results: BitwardenUnEncryptedIndividualJsonExport | BitwardenUnEncryptedOrgJsonExport
  ) {
    const groupingsMap = this.organization
      ? await this.parseCollections(results as BitwardenUnEncryptedOrgJsonExport)
      : await this.parseFolders(results as BitwardenUnEncryptedIndividualJsonExport);

    results.items.forEach((c) => {
      const cipher = CipherWithIdExport.toView(c);
      // reset ids incase they were set for some reason
      cipher.id = null;
      cipher.organizationId = null;
      cipher.collectionIds = null;

      // make sure password history is limited
      if (cipher.passwordHistory != null && cipher.passwordHistory.length > 5) {
        cipher.passwordHistory = cipher.passwordHistory.slice(0, 5);
      }

      if (!this.organization && c.folderId != null && groupingsMap.has(c.folderId)) {
        this.result.folderRelationships.push([
          this.result.ciphers.length,
          groupingsMap.get(c.folderId),
        ]);
      } else if (this.organization && c.collectionIds != null) {
        c.collectionIds.forEach((cId) => {
          if (groupingsMap.has(cId)) {
            this.result.collectionRelationships.push([
              this.result.ciphers.length,
              groupingsMap.get(cId),
            ]);
          }
        });
      }

      this.cleanupCipher(cipher);
      this.result.ciphers.push(cipher);
    });

    this.result.success = true;
  }

  private async parseFolders(
    data: BitwardenUnEncryptedIndividualJsonExport | BitwardenEncryptedIndividualJsonExport
  ): Promise<Map<string, number>> | null {
    if (data.folders == null) {
      return null;
    }

    const groupingsMap = new Map<string, number>();

    for (const f of data.folders) {
      let folderView: FolderView;
      if (data.encrypted) {
        const folder = FolderWithIdExport.toDomain(f);
        if (folder != null) {
          folderView = await folder.decrypt();
        }
      } else {
        folderView = FolderWithIdExport.toView(f);
      }

      if (folderView != null) {
        groupingsMap.set(f.id, this.result.folders.length);
        this.result.folders.push(folderView);
      }
    }
    return groupingsMap;
  }

  private async parseCollections(
    data: BitwardenUnEncryptedOrgJsonExport | BitwardenEncryptedOrgJsonExport
  ): Promise<Map<string, number>> | null {
    if (data.collections == null) {
      return null;
    }

    const groupingsMap = new Map<string, number>();

    for (const c of data.collections) {
      let collectionView: CollectionView;
      if (data.encrypted) {
        const collection = CollectionWithIdExport.toDomain(c);
        collection.organizationId = this.organizationId;
        collectionView = await collection.decrypt();
      } else {
        collectionView = CollectionWithIdExport.toView(c);
        collectionView.organizationId = null;
      }

      if (collectionView != null) {
        groupingsMap.set(c.id, this.result.collections.length);
        this.result.collections.push(collectionView);
      }
    }
    return groupingsMap;
  }
}
