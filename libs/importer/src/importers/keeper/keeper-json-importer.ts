// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

import { KeeperJsonExport, RecordsEntity } from "./types/keeper-json-types";

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

      const cipher = this.initLoginCipher();
      cipher.name = record.title;
      cipher.login.username = record.login;
      cipher.login.password = record.password;

      cipher.login.uris = this.makeUriArray(record.login_url);
      cipher.notes = record.notes;

      if (record.custom_fields != null) {
        let customfieldKeys = Object.keys(record.custom_fields);
        if (record.custom_fields["TFC:Keeper"] != null) {
          customfieldKeys = customfieldKeys.filter((item) => item !== "TFC:Keeper");
          cipher.login.totp = record.custom_fields["TFC:Keeper"];
        }

        customfieldKeys.forEach((key) => {
          this.processKvp(cipher, key, record.custom_fields[key]);
        });
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

  private parseFolders(result: ImportResult, record: RecordsEntity) {
    if (record.folders == null || record.folders.length === 0) {
      return;
    }

    record.folders.forEach((item) => {
      if (item.folder != null) {
        this.processFolder(result, item.folder);
        return;
      }

      if (item.shared_folder != null) {
        this.processFolder(result, item.shared_folder);
        return;
      }
    });
  }
}
