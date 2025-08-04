// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as JSZip from "jszip";
import * as papa from "papaparse";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { CipherWithIdExport, FolderWithIdExport } from "@bitwarden/common/models/export";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";

import {
  BitwardenCsvIndividualExportType,
  BitwardenEncryptedIndividualJsonExport,
  BitwardenUnEncryptedIndividualJsonExport,
  ExportedVault,
  ExportedVaultAsBlob,
  ExportedVaultAsString,
} from "../types";

import { BaseVaultExportService } from "./base-vault-export.service";
import { ExportHelper } from "./export-helper";
import { IndividualVaultExportServiceAbstraction } from "./individual-vault-export.service.abstraction";
import { ExportFormat } from "./vault-export.service.abstraction";

export class IndividualVaultExportService
  extends BaseVaultExportService
  implements IndividualVaultExportServiceAbstraction
{
  constructor(
    private folderService: FolderService,
    private cipherService: CipherService,
    pinService: PinServiceAbstraction,
    private keyService: KeyService,
    encryptService: EncryptService,
    cryptoFunctionService: CryptoFunctionService,
    kdfConfigService: KdfConfigService,
    private accountService: AccountService,
    private apiService: ApiService,
    private restrictedItemTypesService: RestrictedItemTypesService,
  ) {
    super(pinService, encryptService, cryptoFunctionService, kdfConfigService);
  }

  /** Creates an export of an individual vault (My Vault). Based on the provided format it will either be unencrypted, encrypted or password protected and in case zip is selected will include attachments
   * @param format The format of the export
   */
  async getExport(format: ExportFormat = "csv"): Promise<ExportedVault> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    if (format === "encrypted_json") {
      return this.getEncryptedExport(userId);
    } else if (format === "zip") {
      return this.getDecryptedExportZip(userId);
    }
    return this.getDecryptedExport(userId, format);
  }

  /** Creates a password protected export of an individual vault (My Vault) as a JSON file
   * @param password The password to encrypt the export with
   * @returns A password-protected encrypted individual vault export
   */
  async getPasswordProtectedExport(password: string): Promise<ExportedVaultAsString> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const exportVault = await this.getExport("json");

    if (exportVault.type !== "text/plain") {
      throw new Error("Unexpected export type");
    }

    return {
      type: "text/plain",
      data: await this.buildPasswordExport(userId, exportVault.data, password),
      fileName: ExportHelper.getFileName("", "encrypted_json"),
    } as ExportedVaultAsString;
  }

  /** Creates a unencrypted export of an individual vault including attachments
   * @param activeUserId The user ID of the user requesting the export
   * @returns A unencrypted export including attachments
   */
  async getDecryptedExportZip(activeUserId: UserId): Promise<ExportedVaultAsBlob> {
    const zip = new JSZip();

    // ciphers
    const exportedVault = await this.getDecryptedExport(activeUserId, "json");
    zip.file("data.json", exportedVault.data);

    const attachmentsFolder = zip.folder("attachments");
    if (attachmentsFolder == null) {
      throw new Error("Error creating attachments folder");
    }

    // attachments
    for (const cipher of await this.cipherService.getAllDecrypted(activeUserId)) {
      if (
        !cipher.attachments ||
        cipher.attachments.length === 0 ||
        cipher.deletedDate != null ||
        cipher.organizationId != null
      ) {
        continue;
      }

      const cipherFolder = attachmentsFolder.folder(cipher.id);
      for (const attachment of cipher.attachments) {
        const response = await this.downloadAttachment(cipher.id, attachment.id);

        try {
          const decBuf = await this.cipherService.getDecryptedAttachmentBuffer(
            cipher.id as CipherId,
            attachment,
            response,
            activeUserId,
          );

          cipherFolder.file(attachment.fileName, decBuf);
        } catch {
          throw new Error("Error decrypting attachment");
        }
      }
    }

    const blobData = await zip.generateAsync({ type: "blob" });

    return {
      type: "application/zip",
      data: blobData,
      fileName: ExportHelper.getFileName("", "zip"),
    } as ExportedVaultAsBlob;
  }

  private async downloadAttachment(cipherId: string, attachmentId: string): Promise<Response> {
    const attachmentDownloadResponse = await this.apiService.getAttachmentData(
      cipherId,
      attachmentId,
    );
    const url = attachmentDownloadResponse.url;

    const response = await fetch(new Request(url, { cache: "no-store" }));
    if (response.status !== 200) {
      throw new Error("Error downloading attachment");
    }
    return response;
  }

  private async getDecryptedExport(
    activeUserId: UserId,
    format: "json" | "csv",
  ): Promise<ExportedVaultAsString> {
    let decFolders: FolderView[] = [];
    let decCiphers: CipherView[] = [];
    const promises = [];

    promises.push(
      firstValueFrom(this.folderService.folderViews$(activeUserId)).then((folders) => {
        decFolders = folders;
      }),
    );

    const restrictions = await firstValueFrom(this.restrictedItemTypesService.restricted$);

    promises.push(
      this.cipherService.getAllDecrypted(activeUserId).then((ciphers) => {
        decCiphers = ciphers.filter(
          (f) =>
            f.deletedDate == null &&
            !this.restrictedItemTypesService.isCipherRestricted(f, restrictions),
        );
      }),
    );

    await Promise.all(promises);

    if (format === "csv") {
      return {
        type: "text/plain",
        data: this.buildCsvExport(decFolders, decCiphers),
        fileName: ExportHelper.getFileName("", "csv"),
      } as ExportedVaultAsString;
    }

    return {
      type: "text/plain",
      data: this.buildJsonExport(decFolders, decCiphers),
      fileName: ExportHelper.getFileName("", "json"),
    } as ExportedVaultAsString;
  }

  private async getEncryptedExport(activeUserId: UserId): Promise<ExportedVaultAsString> {
    let folders: Folder[] = [];
    let ciphers: Cipher[] = [];
    const promises = [];

    promises.push(
      firstValueFrom(this.folderService.folders$(activeUserId)).then((f) => {
        folders = f;
      }),
    );

    const restrictions = await firstValueFrom(this.restrictedItemTypesService.restricted$);

    promises.push(
      this.cipherService.getAll(activeUserId).then((c) => {
        ciphers = c.filter(
          (f) =>
            f.deletedDate == null &&
            !this.restrictedItemTypesService.isCipherRestricted(f, restrictions),
        );
      }),
    );

    await Promise.all(promises);

    const userKey = await this.keyService.getUserKey(activeUserId);
    const encKeyValidation = await this.encryptService.encryptString(Utils.newGuid(), userKey);

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

    return {
      type: "text/plain",
      data: JSON.stringify(jsonDoc, null, "  "),
      fileName: ExportHelper.getFileName("", "encrypted_json"),
    } as ExportedVaultAsString;
  }

  private buildCsvExport(decFolders: FolderView[], decCiphers: CipherView[]): string {
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
  }

  private buildJsonExport(decFolders: FolderView[], decCiphers: CipherView[]): string {
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
