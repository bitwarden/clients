// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";
import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import {
  CipherWithIdExport,
  CollectionWithIdExport,
  FolderWithIdExport,
} from "@bitwarden/common/models/export";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { KeyService } from "@bitwarden/key-management";
import {
  BitwardenEncryptedIndividualJsonExport,
  BitwardenEncryptedOrgJsonExport,
  BitwardenJsonExport,
  BitwardenUnEncryptedIndividualJsonExport,
  BitwardenUnEncryptedOrgJsonExport,
} from "@bitwarden/vault-export-core";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

export class BitwardenJsonImporter extends BaseImporter implements Importer {
  private result: ImportResult;

  protected constructor(
    protected keyService: KeyService,
    protected encryptService: EncryptService,
    protected i18nService: I18nService,
    protected cipherService: CipherService,
    protected pinService: PinServiceAbstraction,
    protected accountService: AccountService,
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
    results: BitwardenEncryptedIndividualJsonExport | BitwardenEncryptedOrgJsonExport,
  ) {
    if (results.encKeyValidation_DO_NOT_EDIT != null) {
      let keyForDecryption: SymmetricCryptoKey = await this.keyService.getOrgKey(
        this.organizationId,
      );
      if (keyForDecryption == null) {
        keyForDecryption = await this.keyService.getUserKey();
      }
      const encKeyValidation = new EncString(results.encKeyValidation_DO_NOT_EDIT);
      try {
        await this.encryptService.decryptString(encKeyValidation, keyForDecryption);
      } catch {
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

      const activeUserId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      const view = await this.cipherService.decrypt(cipher, activeUserId);
      this.cleanupCipher(view);
      this.result.ciphers.push(view);
    }

    this.result.success = true;
  }

  private async parseDecrypted(
    results: BitwardenUnEncryptedIndividualJsonExport | BitwardenUnEncryptedOrgJsonExport,
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
    data: BitwardenUnEncryptedIndividualJsonExport | BitwardenEncryptedIndividualJsonExport,
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
    data: BitwardenUnEncryptedOrgJsonExport | BitwardenEncryptedOrgJsonExport,
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
        collectionView = await firstValueFrom(this.keyService.activeUserOrgKeys$).then((orgKeys) =>
          collection.decrypt(orgKeys[c.organizationId as OrganizationId]),
        );
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
