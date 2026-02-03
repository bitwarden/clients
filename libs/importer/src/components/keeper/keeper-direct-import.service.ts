import { Injectable } from "@angular/core";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";
import { DialogService } from "@bitwarden/components";

import {
  ClientOptions,
  Vault,
  VaultFolder,
  VaultRecord,
  VaultSharedFolder,
} from "../../importers/keeper/access";
import { ImportResult } from "../../models";

import { KeeperPasswordPromptComponent } from "./dialog/keeper-password-prompt.component";
import { KeeperDirectImportUIService } from "./keeper-direct-import-ui.service";

@Injectable({
  providedIn: "root",
})
export class KeeperDirectImportService {
  constructor(
    private keeperDirectImportUIService: KeeperDirectImportUIService,
    private dialogService: DialogService,
  ) {}

  /**
   * Import a Keeper account by email
   * @param email The Keeper account email
   * @param includeSharedFolders Whether to include shared folders in the import
   * @returns The ImportResult containing imported vault data
   */
  async handleImport(email: string, includeSharedFolders: boolean): Promise<ImportResult> {
    const password = await KeeperPasswordPromptComponent.open(this.dialogService);

    if (!password) {
      throw new Error("Authentication cancelled");
    }

    const options: ClientOptions = {
      ui: this.keeperDirectImportUIService,
    };

    const vault = await Vault.open(email, password, options);

    return this.convertVaultToImportResult(vault, includeSharedFolders);
  }

  private convertVaultToImportResult(vault: Vault, includeSharedFolders: boolean): ImportResult {
    const result = new ImportResult();

    // Build folder lookup maps
    const folderMap = new Map<string, VaultFolder>();
    const sharedFolderMap = new Map<string, VaultSharedFolder>();

    for (const folder of vault.getFolders()) {
      folderMap.set(folder.uid, folder);
    }

    for (const sharedFolder of vault.getSharedFolders()) {
      sharedFolderMap.set(sharedFolder.uid, sharedFolder);
    }

    // Process records
    for (const record of vault.getRecords()) {
      // Skip shared folder records if not including them
      if (!includeSharedFolders && record.sharedFolderUid) {
        continue;
      }

      const cipher = this.convertRecordToCipher(record);

      // Determine folder name
      let folderName: string | null = null;

      if (record.sharedFolderUid && includeSharedFolders) {
        const sharedFolder = sharedFolderMap.get(record.sharedFolderUid);
        if (sharedFolder) {
          folderName = sharedFolder.name;
        }
      }

      // Process folder relationship
      if (folderName) {
        this.processFolder(result, folderName);
      }

      result.ciphers.push(cipher);
    }

    result.success = true;
    return result;
  }

  private convertRecordToCipher(record: VaultRecord): CipherView {
    const cipher = new CipherView();
    cipher.favorite = false;
    cipher.notes = record.notes || "";
    cipher.fields = [];
    cipher.name = record.title || "--";

    // Determine cipher type based on record type and content
    const hasLogin = !this.isNullOrWhitespace(record.login);
    const hasPassword = !this.isNullOrWhitespace(record.password);
    const hasUrl = !this.isNullOrWhitespace(record.url);

    if (hasLogin || hasPassword || hasUrl || record.type === "login") {
      cipher.type = CipherType.Login;
      cipher.login = new LoginView();
      cipher.login.username = record.login || null;
      cipher.login.password = record.password || null;
      cipher.login.uris = this.makeUriArray(record.url);

      // Look for TOTP in fields
      const totpField = record.fields.find(
        (f) => f.type === "oneTimeCode" || f.label?.toLowerCase() === "totp",
      );
      if (totpField && totpField.value.length > 0) {
        cipher.login.totp = String(totpField.value[0]);
      }
    } else {
      // Treat as secure note if no login data
      cipher.type = CipherType.SecureNote;
      cipher.secureNote = new SecureNoteView();
      cipher.secureNote.type = 0; // Generic
    }

    // Process custom fields
    for (const field of record.customFields) {
      this.processField(cipher, field.label || field.type, field.value);
    }

    // Process standard fields that weren't used for login data
    for (const field of record.fields) {
      // Skip fields already used for login/password/url/totp
      if (
        field.type === "login" ||
        field.type === "password" ||
        field.type === "url" ||
        field.type === "oneTimeCode"
      ) {
        continue;
      }
      this.processField(cipher, field.label || field.type, field.value);
    }

    this.cleanupCipher(cipher);

    return cipher;
  }

  private processField(cipher: CipherView, name: string, value: unknown[]): void {
    if (!value || value.length === 0) {
      return;
    }

    const stringValue = value.map((v) => String(v)).join(", ");

    if (this.isNullOrWhitespace(stringValue)) {
      return;
    }

    const field = new FieldView();
    field.name = name || "";
    field.value = stringValue;
    field.type = 0; // Text
    cipher.fields.push(field);
  }

  private processFolder(result: ImportResult, folderName: string): void {
    if (this.isNullOrWhitespace(folderName)) {
      return;
    }

    let folderIndex = result.folders.length;
    folderName = folderName.replace(/\\/g, "/");
    let addFolder = true;

    for (let i = 0; i < result.folders.length; i++) {
      if (result.folders[i].name === folderName) {
        addFolder = false;
        folderIndex = i;
        break;
      }
    }

    if (addFolder) {
      const f = new FolderView();
      f.name = folderName;
      result.folders.push(f);
    }

    result.folderRelationships.push([result.ciphers.length, folderIndex]);
  }

  private makeUriArray(uri: string | undefined | null): LoginUriView[] | null {
    if (this.isNullOrWhitespace(uri)) {
      return null;
    }

    const loginUri = new LoginUriView();
    loginUri.uri = this.fixUri(uri!);

    if (this.isNullOrWhitespace(loginUri.uri)) {
      return null;
    }

    return [loginUri];
  }

  private fixUri(uri: string): string {
    uri = uri.trim();
    if (uri.indexOf("://") === -1 && uri.indexOf(".") >= 0) {
      uri = "http://" + uri;
    }
    if (uri.length > 1000) {
      return uri.substring(0, 1000);
    }
    return uri;
  }

  private cleanupCipher(cipher: CipherView): void {
    if (cipher.type !== CipherType.Login) {
      cipher.login = null;
    }
    if (this.isNullOrWhitespace(cipher.name)) {
      cipher.name = "--";
    }
    if (this.isNullOrWhitespace(cipher.notes)) {
      cipher.notes = null;
    }
    if (cipher.fields && cipher.fields.length === 0) {
      cipher.fields = null;
    }
  }

  private isNullOrWhitespace(str: string | undefined | null): boolean {
    return Utils.isNullOrWhitespace(str);
  }
}
