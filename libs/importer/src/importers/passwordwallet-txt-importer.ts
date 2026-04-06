import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class PasswordWalletTxtImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, false);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      if (value.length < 1) {
        return;
      }
      if (value.length > 5) {
        this.processFolder(result, value[5]);
      }
      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(value[0], "--");
      if (value.length > 4) {
        cipher.notes = this.getValueOrDefault(value[4], "").split("¬").join("\n");
      }
      if (value.length > 2) {
        cipher.login.username = this.getValueOrDefault(value[2]);
      }
      if (value.length > 3) {
        cipher.login.password = this.getValueOrDefault(value[3]);
      }
      if (value.length > 1) {
        cipher.login.uris = this.makeUriArray(value[1]);
      }
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }
}
