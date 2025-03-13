// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as JSZip from "jszip";
import * as papa from "papaparse";
import { firstValueFrom } from "rxjs";

import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { CipherWithIdExport, FolderWithIdExport } from "@bitwarden/common/models/export";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";

import {
  BitwardenCsvIndividualExportType,
  BitwardenEncryptedIndividualJsonExport,
  BitwardenUnEncryptedIndividualJsonExport,
} from "../types";

import { BaseVaultExportService } from "./base-vault-export.service";
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
  ) {
    super(pinService, encryptService, cryptoFunctionService, kdfConfigService);
  }

  async getExport(format: ExportFormat = "csv"): Promise<string | Blob> {
    if (format === "encrypted_json") {
      return this.getEncryptedExport();
    } else if (format === "zip") {
      return this.getDecryptedExportZip();
    }
    return this.getDecryptedExport(format);
  }

  async getPasswordProtectedExport(password: string): Promise<string> {
    const clearText = (await this.getExport("json")) as string;
    return this.buildPasswordExport(clearText, password);
  }

  async getDecryptedExportZip(): Promise<Blob> {
    const zip = new JSZip();

    // ciphers
    const dataJson = await this.getDecryptedExport("json");
    zip.file("data.json", dataJson);

    const attachmentsFolder = zip.folder("attachments");

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

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
        const decBuf = await this.decryptAttachment(cipher, attachment, response);
        cipherFolder.file(attachment.fileName, decBuf);
      }
    }

    return zip.generateAsync({ type: "blob" });
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

  private async decryptAttachment(
    cipher: CipherView,
    attachment: AttachmentView,
    response: Response,
  ) {
    try {
      const encBuf = await EncArrayBuffer.fromResponse(response);
      const key =
        attachment.key != null
          ? attachment.key
          : await this.keyService.getOrgKey(cipher.organizationId);
      return await this.encryptService.decryptToBytes(encBuf, key);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      throw new Error("Error decrypting attachment");
    }
  }

  private async getDecryptedExport(format: "json" | "csv"): Promise<string> {
    let decFolders: FolderView[] = [];
    let decCiphers: CipherView[] = [];
    const promises = [];
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    promises.push(
      firstValueFrom(this.folderService.folderViews$(activeUserId)).then((folders) => {
        decFolders = folders;
      }),
    );

    promises.push(
      this.cipherService.getAllDecrypted(activeUserId).then((ciphers) => {
        decCiphers = ciphers.filter((f) => f.deletedDate == null);
      }),
    );

    await Promise.all(promises);

    if (format === "csv") {
      return this.buildCsvExport(decFolders, decCiphers);
    }

    return this.buildJsonExport(decFolders, decCiphers);
  }

  private async getEncryptedExport(): Promise<string> {
    let folders: Folder[] = [];
    let ciphers: Cipher[] = [];
    const promises = [];
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    promises.push(
      firstValueFrom(this.folderService.folders$(activeUserId)).then((f) => {
        folders = f;
      }),
    );

    promises.push(
      this.cipherService.getAll(activeUserId).then((c) => {
        ciphers = c.filter((f) => f.deletedDate == null);
      }),
    );

    await Promise.all(promises);

    const userKey = await this.keyService.getUserKeyWithLegacySupport(
      await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId)),
    );
    const encKeyValidation = await this.encryptService.encrypt(Utils.newGuid(), userKey);

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
