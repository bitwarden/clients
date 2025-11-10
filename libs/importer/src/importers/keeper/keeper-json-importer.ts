// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CipherType } from "@bitwarden/common/vault/enums";
import { FieldType } from "@bitwarden/common/vault/enums/field-type.enum";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

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
          {
            cipher.type = CipherType.Card;
            cipher.card.cardholderName = this.findCustomField(
              record.custom_fields,
              "$text:cardholderName",
            );
            cipher.card.number = this.findCustomField(
              record.custom_fields,
              "$paymentCard/cardNumber",
            );
            cipher.card.code = this.findCustomField(
              record.custom_fields,
              "$paymentCard/cardSecurityCode",
            );
            cipher.card.brand = CardView.getCardBrandByPatterns(cipher.card.number);
            const expDate = this.findCustomField(
              record.custom_fields,
              "$paymentCard/cardExpirationDate",
            );
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
            delete record.custom_fields["$paymentCard"];
            delete record.custom_fields["$text:cardholderName"];
            delete record.custom_fields["$pinCode"];
          }
          break;
        case "sshKeys":
          {
            cipher.type = CipherType.SshKey;
            cipher.sshKey.privateKey = this.findCustomField(
              record.custom_fields,
              "$keyPair/privateKey",
            );
            cipher.sshKey.publicKey = this.findCustomField(
              record.custom_fields,
              "$keyPair/publicKey",
            );
            cipher.sshKey.keyFingerprint = "TODO: figure this out"; // TODO: Keeper does not export fingerprint, compute it?

            if (!this.isNullOrWhitespace(cipher.login.username)) {
              this.addField(cipher, "username", cipher.login.username!);
            }
            if (!this.isNullOrWhitespace(cipher.login.password)) {
              this.addField(cipher, "passphrase", cipher.login.password!, FieldType.Hidden);
            }

            const hostName = this.findCustomField(record.custom_fields, "$host/hostName");
            if (hostName) {
              this.addField(cipher, "hostname", hostName);
            }
            const port = this.findCustomField(record.custom_fields, "$host/port");
            if (port) {
              this.addField(cipher, "port", port);
            }

            // These should not be imported as custom fields since they are mapped to ssh key properties
            delete record.custom_fields["$keyPair"];
            delete record.custom_fields["$host"];
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

  private findCustomField(customFields: CustomFields, path: string): string {
    let root = customFields as any;
    for (const part of path.split("/")) {
      if (root[part] == null) {
        return "";
      }
      root = root[part];
    }

    return root.toString();
  }

  private importCustomFields(customFields: CustomFields, cipher: CipherView) {
    for (const [key, value] of Object.entries(customFields)) {
      // TODO: Add more known custom fields here as needed
      // Process known custom fields
      if (key == "$oneTimeCode" || key.startsWith("$oneTimeCode:")) {
        cipher.login.totp = this.getStringOrFirstFromArray(value ?? "");
      } else if (key === "$url" || key.startsWith("$url:")) {
        cipher.login.uris.push(...this.makeUriArray(value));
      } else if (key === "$host" || key.startsWith("$host:")) {
        this.addField(cipher, "hostname", value?.hostName);
        this.addField(cipher, "port", value?.port);
      } else {
        this.addField(cipher, key, value);
      }
    }
  }

  private addField(cipher: CipherView, name: string, value: any, type: FieldType = FieldType.Text) {
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
