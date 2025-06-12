// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FieldType } from "@bitwarden/common/vault/enums";

import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class RoboFormCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    let i = 1;
    results.forEach((value) => {
      const folder =
        !this.isNullOrWhitespace(value.Folder) && value.Folder.startsWith("/")
          ? value.Folder.replace("/", "")
          : value.Folder;
      const folderName = !this.isNullOrWhitespace(folder) ? folder : null;
      this.processFolder(result, folderName);

      const cipher = this.initLoginCipher();
      cipher.notes = this.getValueOrDefault(value.Note);
      cipher.name = this.getValueOrDefault(value.Name, "--");
      cipher.login.username = this.getValueOrDefault(value.Login);
      cipher.login.password = this.getValueOrDefault(value.Pwd);
      cipher.login.uris = this.makeUriArray(value.Url);

      if (!this.isNullOrWhitespace(value.Rf_fields)) {
        let fields: string[] = [value.Rf_fields];
        if (value.__parsed_extra != null && value.__parsed_extra.length > 0) {
          fields = fields.concat(value.__parsed_extra);
        }
        fields.forEach((field: string) => {
          const parts = field.split(":");
          if (parts.length < 3) {
            return;
          }
          const key = parts[0] === "-no-name-" ? null : parts[0];
          const val = parts.length === 4 && parts[2] === "rck" ? parts[1] : parts[2];
          this.processKvp(cipher, key, val);
        });
      } else if (!this.isNullOrWhitespace(value.RfFieldsV2)) {
        let fields: string[] = [value.RfFieldsV2];
        if (value.__parsed_extra != null && value.__parsed_extra.length > 0) {
          fields = fields.concat(value.__parsed_extra);
        }
        fields.forEach((field: string) => {
          const parts = field.split(",");
          if (parts.length < 5) {
            return;
          }
          const key = parts[0] === "-no-name-" ? null : parts[0];
          const type = parts[3] === "pwd" ? FieldType.Hidden : FieldType.Text;
          const val = parts[4];

          if (key === "User ID$" || key === "Password$" || key === "Script$") {
            return;
          } else if (key === "TOTP KEY$") {
            cipher.login.totp = val;
          } else {
            this.processKvp(cipher, key, val, type);
          }
        });
      }

      this.convertToNoteIfNeeded(cipher);
      this.cleanupCipher(cipher);

      if (
        i === results.length &&
        cipher.name === "--" &&
        this.isNullOrWhitespace(cipher.login.password)
      ) {
        return;
      }

      result.ciphers.push(cipher);
      i++;
    });

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }
}
