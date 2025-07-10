import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class UpmCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, false);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      if (value.length !== 5) {
        return;
      }
      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(value[0], "--");
      cipher.notes = this.getValueOrDefault(value[4]);
      cipher.login.username = this.getValueOrDefault(value[1]);
      cipher.login.password = this.getValueOrDefault(value[2]);
      cipher.login.uris = this.makeUriArray(value[3]);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
