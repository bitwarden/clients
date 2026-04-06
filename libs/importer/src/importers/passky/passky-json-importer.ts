import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

import { PasskyJsonExport } from "./passky-json-types";

export class PasskyJsonImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const passkyExport: PasskyJsonExport = JSON.parse(data);
    if (
      passkyExport == null ||
      passkyExport.passwords == null ||
      passkyExport.passwords.length === 0
    ) {
      result.success = false;
      return Promise.resolve(result);
    }

    if (passkyExport.encrypted == true) {
      result.success = false;
      result.errorMessage = "Unable to import an encrypted passky backup.";
      return Promise.resolve(result);
    }

    passkyExport.passwords.forEach((record) => {
      const cipher = this.initLoginCipher();
      cipher.name = record.website;
      cipher.login.username = record.username;
      cipher.login.password = record.password;

      cipher.login.uris = this.makeUriArray(record.website);
      cipher.notes = record.message;

      this.convertToNoteIfNeeded(cipher);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
