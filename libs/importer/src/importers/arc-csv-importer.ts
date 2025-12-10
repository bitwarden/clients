import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class ArcCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      const cipher = this.initLoginCipher();
      const url = this.getValueOrDefault(value.url);
      cipher.name = this.getValueOrDefault(this.nameFromUrl(url) ?? "", "--");
      cipher.login.username = this.getValueOrDefault(value.username);
      cipher.login.password = this.getValueOrDefault(value.password);
      cipher.login.uris = this.makeUriArray(value.url);
      cipher.notes = this.getValueOrDefault(value.note);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
