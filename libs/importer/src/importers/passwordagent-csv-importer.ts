// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class PasswordAgentCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, false);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    let newVersion = true;
    results.forEach((value) => {
      if (value.length !== 5 && value.length < 9) {
        return;
      }
      const altFormat = value.length === 10 && value[0] === "0";
      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(value[altFormat ? 1 : 0], "--");
      cipher.login.username = this.getValueOrDefault(value[altFormat ? 2 : 1]);
      cipher.login.password = this.getValueOrDefault(value[altFormat ? 3 : 2]);
      if (value.length === 5) {
        newVersion = false;
        cipher.notes = this.getValueOrDefault(value[4]);
        cipher.login.uris = this.makeUriArray(value[3]);
      } else {
        const folder = this.getValueOrDefault(value[altFormat ? 9 : 8], "(None)");
        let folderName = folder !== "(None)" ? folder.split("\\").join("/") : null;
        if (folderName != null) {
          folderName = folder.split(" > ").join("/");
          folderName = folder.split(">").join("/");
        }
        this.processFolder(result, folderName);
        cipher.notes = this.getValueOrDefault(value[altFormat ? 5 : 3]);
        cipher.login.uris = this.makeUriArray(value[4]);
      }
      this.convertToNoteIfNeeded(cipher);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    if (newVersion && this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }
}
