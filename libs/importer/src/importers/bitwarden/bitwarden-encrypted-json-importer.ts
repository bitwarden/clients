// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { filter, firstValueFrom } from "rxjs";

import { Collection } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import {
  CipherWithIdExport,
  CollectionWithIdExport,
  FolderWithIdExport,
} from "@bitwarden/common/models/export";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrgKey, UserKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";
import {
  BitwardenEncryptedIndividualJsonExport,
  BitwardenEncryptedJsonExport,
  BitwardenEncryptedOrgJsonExport,
  BitwardenJsonExport,
  BitwardenPasswordProtectedFileFormat,
  isOrgEncrypted,
  isPasswordProtected,
  isUnencrypted,
} from "@bitwarden/vault-export-core";

import { ImportResult } from "../../models/import-result";
import { Importer } from "../importer";

import { BitwardenJsonImporter } from "./bitwarden-json-importer";

export class BitwardenEncryptedJsonImporter extends BitwardenJsonImporter implements Importer {
  constructor(
    protected keyService: KeyService,
    protected encryptService: EncryptService,
    protected i18nService: I18nService,
    private cipherService: CipherService,
    private accountService: AccountService,
  ) {
    super();
  }

  async parse(data: string): Promise<ImportResult> {
    const results: BitwardenPasswordProtectedFileFormat | BitwardenJsonExport = JSON.parse(data);

    if (isPasswordProtected(results)) {
      throw new Error(
        "Data is password-protected. Use BitwardenPasswordProtectedImporter instead.",
      );
    }

    if (results == null || results.items == null) {
      const result = new ImportResult();
      result.success = false;
      return result;
    }

    if (isUnencrypted(results)) {
      return super.parse(data);
    }

    return await this.parseEncrypted(results);
  }

  private async parseEncrypted(data: BitwardenEncryptedJsonExport): Promise<ImportResult> {
    const result = new ImportResult();
    const account = await firstValueFrom(this.accountService.activeAccount$);

    if (this.isNullOrWhitespace(data.encKeyValidation_DO_NOT_EDIT)) {
      result.success = false;
      result.errorMessage = this.i18nService.t("importEncKeyError");
      return result;
    }

    const orgKeys = await firstValueFrom(this.keyService.orgKeys$(account.id));
    let keyForDecryption: OrgKey | UserKey | null | undefined = orgKeys?.[this.organizationId];
    if (!keyForDecryption) {
      keyForDecryption = await firstValueFrom(this.keyService.userKey$(account.id));
    }

    if (!keyForDecryption) {
      result.success = false;
      result.errorMessage = this.i18nService.t("importEncKeyError");
      return result;
    }
    const encKeyValidation = new EncString(data.encKeyValidation_DO_NOT_EDIT);
    try {
      await this.encryptService.decryptString(encKeyValidation, keyForDecryption);
    } catch {
      result.success = false;
      result.errorMessage = this.i18nService.t("importEncKeyError");
      return result;
    }

    let groupingsMap: Map<string, number> | null = null;
    if (isOrgEncrypted(data)) {
      groupingsMap = await this.parseEncryptedCollections(account.id, data, result);
    } else {
      groupingsMap = await this.parseEncryptedFolders(account.id, data, result);
    }

    for (const c of data.items) {
      const cipher = CipherWithIdExport.toDomain(c);
      // reset ids in case they were set for some reason
      cipher.id = null;
      cipher.organizationId = this.organizationId;
      cipher.collectionIds = null;

      // make sure password history is limited
      if (cipher.passwordHistory != null && cipher.passwordHistory.length > 5) {
        cipher.passwordHistory = cipher.passwordHistory.slice(0, 5);
      }

      if (!this.organization && c.folderId != null && groupingsMap.has(c.folderId)) {
        result.folderRelationships.push([result.ciphers.length, groupingsMap.get(c.folderId)]);
      } else if (this.organization && c.collectionIds != null) {
        c.collectionIds.forEach((cId) => {
          if (groupingsMap.has(cId)) {
            result.collectionRelationships.push([result.ciphers.length, groupingsMap.get(cId)]);
          }
        });
      }

      const view = await this.cipherService.decrypt(cipher, account.id);
      this.cleanupCipher(view);
      result.ciphers.push(view);
    }

    result.success = true;
    return result;
  }

  private async parseEncryptedFolders(
    userId: UserId,
    data: BitwardenEncryptedIndividualJsonExport,
    importResult: ImportResult,
  ): Promise<Map<string, number>> {
    const groupingsMap = new Map<string, number>();

    if (data.folders == null) {
      return groupingsMap;
    }

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));

    for (const f of data.folders) {
      let folderView: FolderView;
      const folder = FolderWithIdExport.toDomain(f);
      if (folder != null) {
        folderView = await folder.decrypt(userKey);
      }

      if (folderView != null) {
        groupingsMap.set(f.id, importResult.folders.length);
        importResult.folders.push(folderView);
      }
    }
    return groupingsMap;
  }

  private async parseEncryptedCollections(
    userId: UserId,
    data: BitwardenEncryptedOrgJsonExport,
    importResult: ImportResult,
  ): Promise<Map<string, number>> {
    const groupingsMap = new Map<string, number>();
    if (data.collections == null) {
      return groupingsMap;
    }

    const orgKeys = await firstValueFrom(
      this.keyService.orgKeys$(userId).pipe(filter((orgKeys) => orgKeys != null)),
    );

    for (const c of data.collections) {
      const collection = CollectionWithIdExport.toDomain(
        c,
        new Collection({
          id: c.id,
          name: new EncString(c.name),
          organizationId: this.organizationId,
        }),
      );

      const orgKey = orgKeys[c.organizationId];
      const collectionView = await collection.decrypt(orgKey, this.encryptService);

      if (collectionView != null) {
        groupingsMap.set(c.id, importResult.collections.length);
        importResult.collections.push(collectionView);
      }
    }
    return groupingsMap;
  }
}
