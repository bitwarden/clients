// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CipherType } from "@bitwarden/common/vault/enums";
import { FieldType } from "@bitwarden/common/vault/enums/field-type.enum";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { import_ssh_key, SshKeyView } from "@bitwarden/sdk-internal";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

import { KeeperJsonExport, Record, CustomFields } from "./types/keeper-json-types";

/**
 * Importer for Keeper (json) format
 * Initially written by @djsmith and temporarily disabled for Feb 2022 release
 * Considered obsolete and should be replaced with new parser logic here.
 */
export class KeeperJsonImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const keeperExport: KeeperJsonExport = JSON.parse(data);
    if (keeperExport == null || keeperExport.records == null || keeperExport.records.length === 0) {
      result.success = false;
      return Promise.resolve(result);
    }

    this.parseSharedFolders(keeperExport, result);
    this.parseRecords(keeperExport, result);

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }

  private parseSharedFolders(keeperExport: KeeperJsonExport, result: ImportResult) {
    if (!keeperExport.shared_folders) {
      return;
    }

    keeperExport.shared_folders.forEach((folder) => {
      this.processFolder(result, folder.path ?? "", false);
    });
  }

  private parseRecords(keeperExport: KeeperJsonExport, result: ImportResult) {
    keeperExport.records.forEach((record) => {
      // TODO: This adds a folder/folders to the import result and records a relationship with the to-be-added cipher.
      //       If for some reason we don't add a cipher later, the whole relationship map becomes invalid.
      this.parseFolders(result, record);

      // TODO: Check the $type field to handle other types of records
      const cipher = this.initLoginCipher();
      cipher.name = record.title ?? "";
      cipher.login.username = record.login ?? "";
      cipher.login.password = record.password ?? "";
      cipher.login.uris = this.makeUriArray(record.login_url);
      cipher.notes = record.notes ?? "";

      // Force type based on the record type
      switch (record.$type) {
        case "bankCard":
          this.importBankCard(record, cipher);
          break;
        case "sshKeys":
          // In Bitwarden the ssh key is supposed to be valid.
          // So we only set the type if we can actually import a key.
          if (!this.importSshKey(record, cipher)) {
            // Otherwise, fallback to secure note
            cipher.type = CipherType.SecureNote;
            // Make sure the passphrase is not lost, if any. The key pair will be imported as a custom field.
            this.addField(cipher, "Passphrase", cipher.login.password, FieldType.Hidden);
          }
          break;
      }

      if (record.custom_fields) {
        this.importCustomFields(record.custom_fields, cipher);
      }

      this.convertToNoteIfNeeded(cipher);
      this.cleanupCipher(cipher);

      result.ciphers.push(cipher);
    });
  }

  private importBankCard(record: Record, cipher: CipherView) {
    cipher.type = CipherType.Card;
    cipher.card.cardholderName = this.findCustomField(record.custom_fields, "$text:cardholderName");
    cipher.card.number = this.findCustomField(record.custom_fields, "$paymentCard/cardNumber");
    cipher.card.code = this.findCustomField(record.custom_fields, "$paymentCard/cardSecurityCode");
    cipher.card.brand = CardView.getCardBrandByPatterns(cipher.card.number);
    const expDate = this.findCustomField(record.custom_fields, "$paymentCard/cardExpirationDate");
    const [expMonth, expYear] = expDate.split("/");
    if (expMonth) {
      cipher.card.expMonth = expMonth;
    }
    if (expYear) {
      cipher.card.expYear = expYear;
    }
    const pinCode = this.findCustomField(record.custom_fields, "$pinCode");
    if (pinCode) {
      this.addField(cipher, "PIN", pinCode, FieldType.Hidden);
    }

    // These should not be imported as custom fields since they are mapped to card properties
    this.deleteTopLevelCustomField(record.custom_fields, "$paymentCard");
    this.deleteTopLevelCustomField(record.custom_fields, "$text:cardholderName");
    this.deleteTopLevelCustomField(record.custom_fields, "$pinCode");
  }

  private importSshKey(record: Record, cipher: CipherView): boolean {
    const privateKey = this.findCustomField(record.custom_fields, "$keyPair/privateKey");
    if (!privateKey) {
      return false;
    }

    let keyView: SshKeyView | null = null;
    try {
      keyView = import_ssh_key(privateKey, cipher.login.password);
    } catch {
      return false;
    }
    if (!keyView) {
      return false;
    }

    cipher.type = CipherType.SshKey;
    cipher.sshKey.privateKey = keyView.privateKey;
    cipher.sshKey.publicKey = keyView.publicKey;
    cipher.sshKey.keyFingerprint = keyView.fingerprint;

    if (!this.isNullOrWhitespace(cipher.login.username)) {
      this.addField(cipher, "Username", cipher.login.username!);
    }

    const hostName = this.findCustomField(record.custom_fields, "$host/hostName");
    if (hostName) {
      this.addField(cipher, "Hostname", hostName);
    }
    const port = this.findCustomField(record.custom_fields, "$host/port");
    if (port) {
      this.addField(cipher, "Port", port);
    }

    // These should not be imported as custom fields since they are mapped to ssh key properties
    this.deleteTopLevelCustomField(record.custom_fields, "$keyPair");
    this.deleteTopLevelCustomField(record.custom_fields, "$host");

    return true;
  }

  private findCustomField(customFields: CustomFields, path: string): string {
    let root = customFields as any;
    for (const part of path.split("/")) {
      const keys = Object.keys(root);
      if (keys.length === 0) {
        return "";
      }

      const key = keys.find((k) => k.replace(/:?:\d$/, "") === part);
      if (!key || root[key] == null) {
        return "";
      }

      root = root[key];
    }

    return root.toString();
  }

  private deleteTopLevelCustomField(customFields: CustomFields, name: string) {
    const key = Object.keys(customFields).find((k) => k.replace(/:?:\d$/, "") === name);
    if (key) {
      delete customFields[key];
    }
  }

  private importCustomFields(customFields: CustomFields, cipher: CipherView) {
    for (const [originalKey, originalValue] of Object.entries(customFields)) {
      const [type, name] = this.parseFieldKey(originalKey);

      // These handle arrays internally
      if (this.tryImportArrayField(type, originalValue, cipher)) {
        continue;
      }

      const importedName = name || type || originalKey;
      const values = this.makeArray(originalValue);

      for (const value of values) {
        // These expand into multiple fields
        if (this.tryImportExpandingField(type, value, cipher)) {
          continue;
        }

        // Import as a single field with JSON.stringify as the last resort fallback
        this.importSingleField(type, importedName, value, cipher);

        // TODO: Remove this eventually! Keep it here while debugging, though.
        // console.log(
        //   `Custom field: '${originalKey}'='${JSON.stringify(originalValue)}':\n  - type='${type}'\n  - name='${name}'\n  - value='${JSON.stringify(originalValue)}'\nConverted to:\n  - name='${importedName}'\n  - value='${importedValue}'`,
        // );
      }
    }
  }

  private tryImportArrayField(
    type: string,
    originalValue: string | string[],
    cipher: CipherView,
  ): boolean {
    switch (type) {
      case "oneTimeCode":
        {
          // TODO: If not a login, add as a custom field
          const totps = this.makeArray(originalValue);
          if (totps.length === 0) {
            break;
          }

          cipher.login.totp = totps[0];
          if (totps.length > 1) {
            totps.slice(1).forEach((code) => {
              this.addField(cipher, "TOTP", code, FieldType.Hidden);
            });
          }
        }
        break;
      case "url":
        // TODO: If not a login, add as a custom field
        cipher.login.uris.push(...this.makeUriArray(originalValue));
        break;
      default:
        return false;
    }

    return true;
  }

  private tryImportExpandingField(type: string, originalValue: any, cipher: CipherView): boolean {
    switch (type) {
      case "host":
        {
          const { hostName, port } = originalValue as { hostName?: string; port?: string };
          this.addField(cipher, "Hostname", hostName);
          this.addField(cipher, "Port", port);
        }
        break;
      case "keyPair":
        {
          const { publicKey, privateKey } = originalValue as {
            publicKey?: string;
            privateKey?: string;
          };
          this.addField(cipher, "Public key", publicKey);
          this.addField(cipher, "Private key", privateKey, FieldType.Hidden);
        }
        break;
      case "securityQuestion":
        {
          for (const { question, answer } of this.makeArray(originalValue) as {
            question?: string;
            answer?: string;
          }[]) {
            this.addField(cipher, "Security question", question);
            this.addField(cipher, "Security question answer", answer, FieldType.Hidden);
          }
        }
        break;
      case "appFiller":
        // Ignored since it's an implementation detail of Keeper
        break;
      default:
        return false;
    }

    return true;
  }

  private importSingleField(type: string, importedName: string, value: any, cipher: CipherView) {
    let importedValue = this.convertToFieldValue(value);
    let importedType = FieldType.Text;

    switch (type) {
      case "date":
      case "birthDate":
      case "expirationDate":
        importedValue = this.parseDate(value);
        break;
      case "name":
        {
          const { first, middle, last } = value as {
            first?: string;
            middle?: string;
            last?: string;
          };
          importedValue = [first, middle, last]
            .filter((x) => !!x)
            .join(" ")
            .trim();
        }
        break;
      case "address":
        {
          const { street1, street2, city, state, zip, country } = value as {
            street1?: string;
            street2?: string;
            city?: string;
            state?: string;
            zip?: string;
            country?: string;
          };
          importedValue = [street1, street2, city, state, zip, country]
            .filter((x) => !!x)
            .join(", ")
            .trim();
        }
        break;
      case "phone":
        {
          const { region, number, ext, type } = value as {
            region?: string;
            number?: string;
            ext?: string;
            type?: string;
          };

          const parts = [];
          if (region) {
            // TODO: Convert to +<code> format?
            parts.push(`(${region})`);
          }
          if (number) {
            parts.push(number);
          }
          if (ext) {
            parts.push(`ext. ${ext}`);
          }
          if (type) {
            parts.push(`(${type})`);
          }

          importedValue = parts.join(" ").trim();
        }
        break;
      case "bankAccount":
        {
          const { accountType, otherType, accountNumber, routingNumber } = value as {
            accountType?: string;
            otherType?: string;
            accountNumber?: string;
            routingNumber?: string;
          };

          const parts = [];
          const type = otherType || accountType;
          if (type) {
            parts.push(`Type: ${type}`);
          }
          if (accountNumber) {
            parts.push(`Account Number: ${accountNumber}`);
          }
          if (routingNumber) {
            parts.push(`Routing Number: ${routingNumber}`);
          }

          importedValue = parts.join(", ").trim();
        }
        break;
      case "pinCode":
      case "secret":
        importedType = FieldType.Hidden;
        break;
      default:
        // Do nothing, default conversion is fine
        break;
    }

    this.addField(cipher, importedName, importedValue, importedType);
  }

  private parseDate(timestamp: string | number): string {
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? "" : date.toLocaleString();
  }

  private parseFieldKey(key: string): [string, string] {
    if (this.isNullOrWhitespace(key)) {
      return ["", ""];
    }

    let fieldType = "";
    let fieldName = "";

    if (key[0] === "$") {
      const pos = key.indexOf(":");
      if (pos > 0) {
        fieldType = key.substring(1, pos).trim();
        fieldName = key.substring(pos + 1).trim();
      } else {
        fieldType = key.substring(1).trim();
        fieldName = "";
      }
    } else {
      fieldType = "";
      fieldName = key;
    }

    if (
      fieldName.length >= 2 &&
      fieldName[fieldName.length - 2] === ":" &&
      /\d/.test(fieldName[fieldName.length - 1])
    ) {
      fieldName = fieldName.substring(0, fieldName.length - 2);
    }

    return [fieldType, fieldName];
  }

  private addField(cipher: CipherView, name: string, value: any, type: FieldType = FieldType.Text) {
    // TODO: Should "" be also discarded?
    if (value == null || typeof value === "undefined") {
      return;
    }

    const field = new FieldView();
    field.type = type;
    field.name = name;
    field.value = this.convertToFieldValue(value);
    cipher.fields.push(field);
  }

  // Just to be safe, value come in all kinds of flavors
  private convertToFieldValue(value: any): string {
    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      // Fallthrough
    }

    return "";
  }

  private getStringOrFirstFromArray(value: string | string[]): string {
    return Array.isArray(value) ? (value[0] ?? "") : value;
  }

  private makeArray(value: any): any[] {
    if (Array.isArray(value)) {
      return value;
    }
    if (value != null) {
      return [value];
    }
    return [];
  }

  private parseFolders(result: ImportResult, record: Record) {
    if (!record.folders) {
      return;
    }

    record.folders.forEach((item) => {
      if (item.folder != null) {
        this.processFolder(result, this.sanitizeFolderName(item.folder));
        return;
      }

      if (item.shared_folder != null) {
        this.processFolder(result, this.sanitizeFolderName(item.shared_folder));
        return;
      }
    });
  }

  private sanitizeFolderName(name: string): string {
    // Both \ and / could be a part of the folder name in Keeper,
    // but we cannot have them in Bitwarden folder names.
    return name.replaceAll("\\\\", "-").replaceAll("/", "-");
  }
}
