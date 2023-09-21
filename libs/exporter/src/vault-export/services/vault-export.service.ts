import * as papa from "papaparse";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { KdfConfig } from "@bitwarden/common/auth/models/domain/kdf-config";
import { KdfType } from "@bitwarden/common/enums";
import {
  CipherWithIdExport,
  CollectionWithIdExport,
  FolderWithIdExport,
} from "@bitwarden/common/models/export";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CollectionData } from "@bitwarden/common/vault/models/data/collection.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { Collection } from "@bitwarden/common/vault/models/domain/collection";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { CollectionDetailsResponse } from "@bitwarden/common/vault/models/response/collection.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { ExportHelper } from "../../export-helper";
import {
  BitwardenCsvExportType,
  BitwardenCsvIndividualExportType,
  BitwardenCsvOrgExportType,
} from "../bitwarden-csv-export-type";
import {
  BitwardenEncryptedIndividualJsonExport,
  BitwardenEncryptedOrgJsonExport,
  BitwardenUnEncryptedIndividualJsonExport,
  BitwardenUnEncryptedOrgJsonExport,
  BitwardenPasswordProtectedFileFormat,
} from "../bitwarden-json-export-types";

import { ExportFormat, VaultExportServiceAbstraction } from "./vault-export.service.abstraction";

export class VaultExportService implements VaultExportServiceAbstraction {
  constructor(
    private folderService: FolderService,
    private cipherService: CipherService,
    private apiService: ApiService,
    private cryptoService: CryptoService,
    private cryptoFunctionService: CryptoFunctionService,
    private stateService: StateService
  ) {}

  async getExport(format: ExportFormat = "csv", organizationId?: string): Promise<string> {
    if (organizationId) {
      return await this.getOrganizationExport(organizationId, format);
    }

    if (format === "encrypted_json") {
      return this.getEncryptedExport();
    } else {
      return this.getDecryptedExport(format);
    }
  }

  async getPasswordProtectedExport(password: string, organizationId?: string): Promise<string> {
    const clearText = organizationId
      ? await this.getOrganizationExport(organizationId, "json")
      : await this.getExport("json");

    const kdfType: KdfType = await this.stateService.getKdfType();
    const kdfConfig: KdfConfig = await this.stateService.getKdfConfig();

    const salt = Utils.fromBufferToB64(await this.cryptoFunctionService.randomBytes(16));
    const key = await this.cryptoService.makePinKey(password, salt, kdfType, kdfConfig);

    const encKeyValidation = await this.cryptoService.encrypt(Utils.newGuid(), key);
    const encText = await this.cryptoService.encrypt(clearText, key);

    const jsonDoc: BitwardenPasswordProtectedFileFormat = {
      encrypted: true,
      passwordProtected: true,
      salt: salt,
      kdfType: kdfType,
      kdfIterations: kdfConfig.iterations,
      kdfMemory: kdfConfig.memory,
      kdfParallelism: kdfConfig.parallelism,
      encKeyValidation_DO_NOT_EDIT: encKeyValidation.encryptedString,
      data: encText.encryptedString,
    };

    return JSON.stringify(jsonDoc, null, "  ");
  }

  async getOrganizationExport(
    organizationId: string,
    format: ExportFormat = "csv"
  ): Promise<string> {
    if (format === "encrypted_json") {
      return this.getOrganizationEncryptedExport(organizationId);
    } else {
      return this.getOrganizationDecryptedExport(organizationId, format);
    }
  }

  getFileName(prefix: string = null, extension = "csv"): string {
    return ExportHelper.getFileName(prefix, extension);
  }

  private async getDecryptedExport(format: "json" | "csv"): Promise<string> {
    let decFolders: FolderView[] = [];
    let decCiphers: CipherView[] = [];
    const promises = [];

    promises.push(
      this.folderService.getAllDecryptedFromState().then((folders) => {
        decFolders = folders;
      })
    );

    promises.push(
      this.cipherService.getAllDecrypted().then((ciphers) => {
        decCiphers = ciphers.filter((f) => f.deletedDate == null);
      })
    );

    await Promise.all(promises);

    if (format === "csv") {
      const foldersMap = new Map<string, FolderView>();
      decFolders.forEach((f) => {
        if (f.id != null) {
          foldersMap.set(f.id, f);
        }
      });

      const exportCiphers: BitwardenCsvIndividualExportType[] = [];
      decCiphers.forEach((c) => {
        // only export logins and secure notes
        if (c.type !== CipherType.Login && c.type !== CipherType.SecureNote) {
          return;
        }
        if (c.organizationId != null) {
          return;
        }

        const cipher = {} as BitwardenCsvIndividualExportType;
        cipher.folder =
          c.folderId != null && foldersMap.has(c.folderId) ? foldersMap.get(c.folderId).name : null;
        cipher.favorite = c.favorite ? 1 : null;
        this.buildCommonCipher(cipher, c);
        exportCiphers.push(cipher);
      });

      return papa.unparse(exportCiphers);
    } else {
      const jsonDoc: BitwardenUnEncryptedIndividualJsonExport = {
        encrypted: false,
        folders: [],
        items: [],
      };

      decFolders.forEach((f) => {
        if (f.id == null) {
          return;
        }
        const folder = new FolderWithIdExport();
        folder.build(f);
        jsonDoc.folders.push(folder);
      });

      decCiphers.forEach((c) => {
        if (c.organizationId != null) {
          return;
        }
        const cipher = new CipherWithIdExport();
        cipher.build(c);
        cipher.collectionIds = null;
        jsonDoc.items.push(cipher);
      });

      return JSON.stringify(jsonDoc, null, "  ");
    }
  }

  private async getEncryptedExport(): Promise<string> {
    let folders: Folder[] = [];
    let ciphers: Cipher[] = [];
    const promises = [];

    promises.push(
      this.folderService.getAllFromState().then((f) => {
        folders = f;
      })
    );

    promises.push(
      this.cipherService.getAll().then((c) => {
        ciphers = c.filter((f) => f.deletedDate == null);
      })
    );

    await Promise.all(promises);

    const encKeyValidation = await this.cryptoService.encrypt(Utils.newGuid());

    const jsonDoc: BitwardenEncryptedIndividualJsonExport = {
      encrypted: true,
      encKeyValidation_DO_NOT_EDIT: encKeyValidation.encryptedString,
      folders: [],
      items: [],
    };

    folders.forEach((f) => {
      if (f.id == null) {
        return;
      }
      const folder = new FolderWithIdExport();
      folder.build(f);
      jsonDoc.folders.push(folder);
    });

    ciphers.forEach((c) => {
      if (c.organizationId != null) {
        return;
      }
      const cipher = new CipherWithIdExport();
      cipher.build(c);
      cipher.collectionIds = null;
      jsonDoc.items.push(cipher);
    });

    return JSON.stringify(jsonDoc, null, "  ");
  }

  private async getOrganizationDecryptedExport(
    organizationId: string,
    format: "json" | "csv"
  ): Promise<string> {
    const decCollections: CollectionView[] = [];
    const decCiphers: CipherView[] = [];
    const promises = [];

    promises.push(
      this.apiService.getOrganizationExport(organizationId).then((exportData) => {
        const exportPromises: any = [];
        if (exportData != null) {
          if (exportData.collections != null && exportData.collections.length > 0) {
            exportData.collections.forEach((c) => {
              const collection = new Collection(new CollectionData(c as CollectionDetailsResponse));
              exportPromises.push(
                collection.decrypt().then((decCol) => {
                  decCollections.push(decCol);
                })
              );
            });
          }
          if (exportData.ciphers != null && exportData.ciphers.length > 0) {
            exportData.ciphers
              .filter((c) => c.deletedDate === null)
              .forEach((c) => {
                const cipher = new Cipher(new CipherData(c));
                exportPromises.push(
                  cipher.decrypt().then((decCipher) => {
                    decCiphers.push(decCipher);
                  })
                );
              });
          }
        }
        return Promise.all(exportPromises);
      })
    );

    await Promise.all(promises);

    if (format === "csv") {
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
    } else {
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
      })
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
      })
    );

    await Promise.all(promises);

    const orgKey = await this.cryptoService.getOrgKey(organizationId);
    const encKeyValidation = await this.cryptoService.encrypt(Utils.newGuid(), orgKey);

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

  private buildCommonCipher(cipher: BitwardenCsvExportType, c: CipherView): BitwardenCsvExportType {
    cipher.type = null;
    cipher.name = c.name;
    cipher.notes = c.notes;
    cipher.fields = null;
    cipher.reprompt = c.reprompt;
    // Login props
    cipher.login_uri = null;
    cipher.login_username = null;
    cipher.login_password = null;
    cipher.login_totp = null;

    if (c.fields) {
      c.fields.forEach((f) => {
        if (!cipher.fields) {
          cipher.fields = "";
        } else {
          cipher.fields += "\n";
        }

        cipher.fields += (f.name || "") + ": " + f.value;
      });
    }

    switch (c.type) {
      case CipherType.Login:
        cipher.type = "login";
        cipher.login_username = c.login.username;
        cipher.login_password = c.login.password;
        cipher.login_totp = c.login.totp;

        if (c.login.uris) {
          cipher.login_uri = [];
          c.login.uris.forEach((u) => {
            cipher.login_uri.push(u.uri);
          });
        }
        break;
      case CipherType.SecureNote:
        cipher.type = "note";
        break;
      default:
        return;
    }

    return cipher;
  }
}
