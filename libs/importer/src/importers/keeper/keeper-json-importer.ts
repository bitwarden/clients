// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FieldType } from "@bitwarden/common/vault/enums/field-type.enum";
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

    keeperExport.records.forEach((record) => {
      this.parseFolders(result, record);

      // TODO: Check the $type field to handle other types of records

      const cipher = this.initLoginCipher();
      cipher.name = record.title ?? "";
      cipher.login.username = record.login ?? "";
      cipher.login.password = record.password ?? "";
      cipher.login.uris = this.makeUriArray(record.login_url);
      cipher.notes = record.notes ?? "";

      if (record.custom_fields) {
        this.importCustomFields(record.custom_fields, cipher);
      }

      this.convertToNoteIfNeeded(cipher);
      this.cleanupCipher(cipher);

      result.ciphers.push(cipher);
    });

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }

  private importCustomFields(customFields: CustomFields, cipher: CipherView) {
    for (const [key, value] of Object.entries(customFields)) {
      // TODO: Add more known custom fields here as needed
      // Process known custom fields
      if (key.startsWith("$oneTimeCode")) {
        cipher.login.totp = this.getStringOrFirstFromArray(value ?? "");
      } else {
        // Add the rest as custom fields
        const field = new FieldView();
        field.type = FieldType.Text;
        field.name = key;
        field.value = value;
        cipher.fields.push(field);
      }
    }
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
