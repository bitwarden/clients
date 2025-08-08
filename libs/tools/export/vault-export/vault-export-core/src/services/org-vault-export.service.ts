// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as papa from "papaparse";
import { firstValueFrom, map } from "rxjs";

import {
  CollectionService,
  CollectionData,
  Collection,
  CollectionDetailsResponse,
  CollectionView,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { CipherWithIdExport, CollectionWithIdExport } from "@bitwarden/common/models/export";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";

import {
  BitwardenCsvOrgExportType,
  BitwardenEncryptedOrgJsonExport,
  BitwardenUnEncryptedOrgJsonExport,
  ExportedVaultAsString,
} from "../types";

import { BaseVaultExportService } from "./base-vault-export.service";
import { ExportHelper } from "./export-helper";
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
    private restrictedItemTypesService: RestrictedItemTypesService,
  ) {
    super(pinService, encryptService, cryptoFunctionService, kdfConfigService);
  }

  /** Creates a password protected export of an organizational vault.
   * @param organizationId The organization id
   * @param password The password to protect the export
   * @param onlyManagedCollections If true only managed collections will be exported
   * @returns The exported vault
   */
  async getPasswordProtectedExport(
    organizationId: string,
    password: string,
    onlyManagedCollections: boolean,
  ): Promise<ExportedVaultAsString> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const exportVault = await this.getOrganizationExport(
      organizationId,
      "json",
      onlyManagedCollections,
    );

    return {
      type: "text/plain",
      data: await this.buildPasswordExport(userId, exportVault.data, password),
      fileName: ExportHelper.getFileName("org", "encrypted_json"),
    } as ExportedVaultAsString;
  }

  /** Creates an export of an organizational vault. Based on the provided format it will either be unencrypted, encrypted
   * @param organizationId The organization id
   * @param format The format of the export
   * @param onlyManagedCollections If true only managed collections will be exported
   * @returns The exported vault
   * @throws Error if the format is zip
   * @throws Error if the organization id is not set
   * @throws Error if the format is not supported
   * @throws Error if the organization policies prevent the export
   */
  async getOrganizationExport(
    organizationId: string,
    format: ExportFormat = "csv",
    onlyManagedCollections: boolean,
  ): Promise<ExportedVaultAsString> {
    if (Utils.isNullOrWhitespace(organizationId)) {
      throw new Error("OrganizationId must be set");
    }

    if (format === "zip") {
      throw new Error("Zip export not supported for organization");
    }
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    if (format === "encrypted_json") {
      return {
        type: "text/plain",
        data: onlyManagedCollections
          ? await this.getEncryptedManagedExport(userId, organizationId)
          : await this.getOrganizationEncryptedExport(organizationId),
        fileName: ExportHelper.getFileName("org", "encrypted_json"),
      } as ExportedVaultAsString;
    }

    return {
      type: "text/plain",
      data: onlyManagedCollections
        ? await this.getDecryptedManagedExport(userId, organizationId, format)
        : await this.getOrganizationDecryptedExport(userId, organizationId, format),
      fileName: ExportHelper.getFileName("org", format),
    } as ExportedVaultAsString;
  }

  private async getOrganizationDecryptedExport(
    activeUserId: UserId,
    organizationId: string,
    format: "json" | "csv",
  ): Promise<string> {
    const decCollections: CollectionView[] = [];
    const decCiphers: CipherView[] = [];
    const promises = [];

    const restrictions = await firstValueFrom(this.restrictedItemTypesService.restricted$);

    promises.push(
      this.apiService.getOrganizationExport(organizationId).then((exportData) => {
        const exportPromises: any = [];
        if (exportData != null) {
          if (exportData.collections != null && exportData.collections.length > 0) {
            exportData.collections.forEach((c) => {
              const collection = Collection.fromCollectionData(
                new CollectionData(c as CollectionDetailsResponse),
              );
              exportPromises.push(
                firstValueFrom(this.keyService.activeUserOrgKeys$)
                  .then((keys) =>
                    collection.decrypt(keys[organizationId as OrganizationId], this.encryptService),
                  )
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
                  this.cipherService.decrypt(cipher, activeUserId).then((decCipher) => {
                    if (
                      !this.restrictedItemTypesService.isCipherRestricted(decCipher, restrictions)
                    ) {
                      decCiphers.push(decCipher);
                    }
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
    let ciphers: Cipher[] = [];
    const promises = [];

    promises.push(
      this.apiService.getCollections(organizationId).then((c) => {
        if (c != null && c.data != null && c.data.length > 0) {
          c.data.forEach((r) => {
            const collection = Collection.fromCollectionData(
              new CollectionData(r as CollectionDetailsResponse),
            );
            collections.push(collection);
          });
        }
      }),
    );

    const restrictions = await firstValueFrom(this.restrictedItemTypesService.restricted$);

    promises.push(
      this.apiService.getCiphersOrganization(organizationId).then((c) => {
        if (c != null && c.data != null && c.data.length > 0) {
          ciphers = c.data
            .filter((item) => item.deletedDate === null)
            .map((item) => new Cipher(new CipherData(item)))
            .filter(
              (cipher) => !this.restrictedItemTypesService.isCipherRestricted(cipher, restrictions),
            );
        }
      }),
    );

    await Promise.all(promises);

    return this.BuildEncryptedExport(organizationId, collections, ciphers);
  }

  private async getDecryptedManagedExport(
    activeUserId: UserId,
    organizationId: string,
    format: "json" | "csv",
  ): Promise<string> {
    let decCiphers: CipherView[] = [];
    let allDecCiphers: CipherView[] = [];
    const promises = [];

    promises.push(
      this.cipherService.getAllDecrypted(activeUserId).then((ciphers) => {
        allDecCiphers = ciphers;
      }),
    );
    await Promise.all(promises);

    const decCollections: CollectionView[] = await firstValueFrom(
      this.collectionService
        .decryptedCollections$(activeUserId)
        .pipe(
          map((collections) =>
            collections.filter((c) => c.organizationId == organizationId && c.manage),
          ),
        ),
    );

    const restrictions = await firstValueFrom(this.restrictedItemTypesService.restricted$);

    decCiphers = allDecCiphers.filter(
      (f) =>
        f.deletedDate == null &&
        f.organizationId == organizationId &&
        decCollections.some((dC) => f.collectionIds.some((cId) => dC.id === cId)) &&
        !this.restrictedItemTypesService.isCipherRestricted(f, restrictions),
    );

    if (format === "csv") {
      return this.buildCsvExport(decCollections, decCiphers);
    }
    return this.buildJsonExport(decCollections, decCiphers);
  }

  private async getEncryptedManagedExport(
    activeUserId: UserId,
    organizationId: string,
  ): Promise<string> {
    let encCiphers: Cipher[] = [];
    let allCiphers: Cipher[] = [];
    const promises = [];

    promises.push(
      this.cipherService.getAll(activeUserId).then((ciphers) => {
        allCiphers = ciphers;
      }),
    );

    await Promise.all(promises);

    const encCollections: Collection[] = await firstValueFrom(
      this.collectionService.encryptedCollections$(activeUserId).pipe(
        map((collections) => collections ?? []),
        map((collections) =>
          collections.filter((c) => c.organizationId == organizationId && c.manage),
        ),
      ),
    );

    const restrictions = await firstValueFrom(this.restrictedItemTypesService.restricted$);

    encCiphers = allCiphers.filter(
      (f) =>
        f.deletedDate == null &&
        f.organizationId == organizationId &&
        encCollections.some((eC) => f.collectionIds.some((cId) => eC.id === cId)) &&
        !this.restrictedItemTypesService.isCipherRestricted(f, restrictions),
    );

    return this.BuildEncryptedExport(organizationId, encCollections, encCiphers);
  }

  private async BuildEncryptedExport(
    organizationId: string,
    collections: Collection[],
    ciphers: Cipher[],
  ): Promise<string> {
    const orgKey = await this.keyService.getOrgKey(organizationId);
    const encKeyValidation = await this.encryptService.encryptString(Utils.newGuid(), orgKey);

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
