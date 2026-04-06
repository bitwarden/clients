import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class YotiCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(value.Name, "--");
      cipher.login.username = this.getValueOrDefault(value["User name"]);
      cipher.login.password = this.getValueOrDefault(value.Password);
      cipher.login.uris = this.makeUriArray(value.URL);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
