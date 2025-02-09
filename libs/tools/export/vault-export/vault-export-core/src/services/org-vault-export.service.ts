// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as papa from "papaparse";
import { firstValueFrom } from "rxjs";

import {
  CollectionService,
  CollectionData,
  Collection,
  CollectionDetailsResponse,
  CollectionView,
} from "@bitwarden/admin-console/common";
import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { CipherWithIdExport, CollectionWithIdExport } from "@bitwarden/common/models/export";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";

import {
  BitwardenCsvOrgExportType,
  BitwardenEncryptedOrgJsonExport,
  BitwardenUnEncryptedOrgJsonExport,
} from "../types";

import { BaseVaultExportService } from "./base-vault-export.service";
import { OrganizationVaultExportServiceAbstraction } from "./org-vault-export.service.abstraction";
import { ExportFormat } from "./vault-export.service.abstraction";

export class OrganizationVaultExportService
  extends BaseVaultExportService
  implements OrganizationVaultExportServiceAbstraction
{
  constructor(
    private cipherService: CipherService,
    private apiService: ApiService,
    pinService: PinServiceAbstraction,
    private keyService: KeyService,
    encryptService: EncryptService,
    cryptoFunctionService: CryptoFunctionService,
    private collectionService: CollectionService,
    kdfConfigService: KdfConfigService,
    private accountService: AccountService,
  ) {
    super(pinService, encryptService, cryptoFunctionService, kdfConfigService);
  }

  async getPasswordProtectedExport(
    organizationId: string,
    password: string,
    onlyManagedCollections: boolean,
  ): Promise<string> {
    const clearText = await this.getOrganizationExport(
      organizationId,
      "json",
      onlyManagedCollections,
    );

    return this.buildPasswordExport(clearText, password);
  }

  async getOrganizationExport(
    organizationId: string,
    format: ExportFormat = "csv",
    onlyManagedCollections: boolean,
  ): Promise<string> {
    if (Utils.isNullOrWhitespace(organizationId)) {
      throw new Error("OrganizationId must be set");
    }

    if (format === "encrypted_json") {
      return onlyManagedCollections
        ? this.getEncryptedManagedExport(organizationId)
        : this.getOrganizationEncryptedExport(organizationId);
    }

    return onlyManagedCollections
      ? this.getDecryptedManagedExport(organizationId, format)
      : this.getOrganizationDecryptedExport(organizationId, format);
  }

  private async getOrganizationDecryptedExport(
    organizationId: string,
    format: "json" | "csv",
  ): Promise<string> {
    const decCollections: CollectionView[] = [];
    const decCiphers: CipherView[] = [];
    const promises = [];
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    promises.push(
      this.apiService.getOrganizationExport(organizationId).then((exportData) => {
        const exportPromises: any = [];
        if (exportData != null) {
          if (exportData.collections != null && exportData.collections.length > 0) {
            exportData.collections.forEach((c) => {
              const collection = new Collection(new CollectionData(c as CollectionDetailsResponse));
              exportPromises.push(
                firstValueFrom(this.keyService.activeUserOrgKeys$)
                  .then((keys) => collection.decrypt(keys[organizationId as OrganizationId]))
                  .then((decCol) => {
                    decCollections.push(decCol);
                  }),
              );
            });
          }
          if (exportData.ciphers != null && exportData.ciphers.length > 0) {
            exportData.ciphers
              .filter((c) => c.deletedDate === null)
              .forEach(async (c) => {
                const cipher = new Cipher(new CipherData(c));
                exportPromises.push(
                  this.cipherService
                    .getKeyForCipherKeyDecryption(cipher, activeUserId)
                    .then((key) => cipher.decrypt(key))
                    .then((decCipher) => {
                      decCiphers.push(decCipher);
                    }),
                );
              });
          }
        }
        return Promise.all(exportPromises);
      }),
    );

    await Promise.all(promises);

    if (format === "csv") {
      return this.buildCsvExport(decCollections, decCiphers);
    }
    return this.buildJsonExport(decCollections, decCiphers);
  }

  private async getOrganizationEncryptedExport(organizationId: string): Promise<string> {
    const collections: Collection[] = [];
    const ciphers: Cipher[] = [];
    const promises = [];

    promises.push(
      this.apiService.getCollections(organizationId).then((c) => {
        if (c != null && c.data != null && c.data.length > 0) {
          c.data.forEach((r) => {
            const collection = new Collection(new CollectionData(r as CollectionDetailsResponse));
            collections.push(collection);
          });
        }
      }),
    );

    promises.push(
      this.apiService.getCiphersOrganization(organizationId).then((c) => {
        if (c != null && c.data != null && c.data.length > 0) {
          c.data
            .filter((item) => item.deletedDate === null)
            .forEach((item) => {
              const cipher = new Cipher(new CipherData(item));
              ciphers.push(cipher);
            });
        }
      }),
    );

    await Promise.all(promises);

    return this.BuildEncryptedExport(organizationId, collections, ciphers);
  }

  private async getDecryptedManagedExport(
    organizationId: string,
    format: "json" | "csv",
  ): Promise<string> {
    let decCiphers: CipherView[] = [];
    let allDecCiphers: CipherView[] = [];
    let decCollections: CollectionView[] = [];
    const promises = [];
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    promises.push(
      this.collectionService.getAllDecrypted().then(async (collections) => {
        decCollections = collections.filter((c) => c.organizationId == organizationId && c.manage);
      }),
    );

    promises.push(
      this.cipherService.getAllDecrypted(activeUserId).then((ciphers) => {
        allDecCiphers = ciphers;
      }),
    );
    await Promise.all(promises);

    decCiphers = allDecCiphers.filter(
      (f) =>
        f.deletedDate == null &&
        f.organizationId == organizationId &&
        decCollections.some((dC) => f.collectionIds.some((cId) => dC.id === cId)),
    );

    if (format === "csv") {
      return this.buildCsvExport(decCollections, decCiphers);
    }
    return this.buildJsonExport(decCollections, decCiphers);
  }

  private async getEncryptedManagedExport(organizationId: string): Promise<string> {
    let encCiphers: Cipher[] = [];
    let allCiphers: Cipher[] = [];
    let encCollections: Collection[] = [];
    const promises = [];
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    promises.push(
      this.collectionService.getAll().then((collections) => {
        encCollections = collections.filter((c) => c.organizationId == organizationId && c.manage);
      }),
    );

    promises.push(
      this.cipherService.getAll(activeUserId).then((ciphers) => {
        allCiphers = ciphers;
      }),
    );

    await Promise.all(promises);

    encCiphers = allCiphers.filter(
      (f) =>
        f.deletedDate == null &&
        f.organizationId == organizationId &&
        encCollections.some((eC) => f.collectionIds.some((cId) => eC.id === cId)),
    );

    return this.BuildEncryptedExport(organizationId, encCollections, encCiphers);
  }

  private async BuildEncryptedExport(
    organizationId: string,
    collections: Collection[],
    ciphers: Cipher[],
  ): Promise<string> {
    const orgKey = await this.keyService.getOrgKey(organizationId);
    const encKeyValidation = await this.encryptService.encrypt(Utils.newGuid(), orgKey);

    const jsonDoc: BitwardenEncryptedOrgJsonExport = {
      encrypted: true,
      encKeyValidation_DO_NOT_EDIT: encKeyValidation.encryptedString,
      collections: [],
      items: [],
    };

    collections.forEach((c) => {
      const collection = new CollectionWithIdExport();
      collection.build(c);
      jsonDoc.collections.push(collection);
    });

    ciphers.forEach((c) => {
      const cipher = new CipherWithIdExport();
      cipher.build(c);
      jsonDoc.items.push(cipher);
    });
    return JSON.stringify(jsonDoc, null, "  ");
  }

  private buildCsvExport(decCollections: CollectionView[], decCiphers: CipherView[]): string {
    const collectionsMap = new Map<string, CollectionView>();
    decCollections.forEach((c) => {
      collectionsMap.set(c.id, c);
    });

    const exportCiphers: BitwardenCsvOrgExportType[] = [];
    decCiphers.forEach((c) => {
      // only export logins and secure notes
      if (c.type !== CipherType.Login && c.type !== CipherType.SecureNote) {
        return;
      }

      const cipher = {} as BitwardenCsvOrgExportType;
      cipher.collections = [];
      if (c.collectionIds != null) {
        cipher.collections = c.collectionIds
          .filter((id) => collectionsMap.has(id))
          .map((id) => collectionsMap.get(id).name);
      }
      this.buildCommonCipher(cipher, c);
      exportCiphers.push(cipher);
    });

    return papa.unparse(exportCiphers);
  }

  private buildJsonExport(decCollections: CollectionView[], decCiphers: CipherView[]): string {
    const jsonDoc: BitwardenUnEncryptedOrgJsonExport = {
      encrypted: false,
      collections: [],
      items: [],
    };

    decCollections.forEach((c) => {
      const collection = new CollectionWithIdExport();
      collection.build(c);
      jsonDoc.collections.push(collection);
    });

    decCiphers.forEach((c) => {
      const cipher = new CipherWithIdExport();
      cipher.build(c);
      jsonDoc.items.push(cipher);
    });
    return JSON.stringify(jsonDoc, null, "  ");
  }
}
