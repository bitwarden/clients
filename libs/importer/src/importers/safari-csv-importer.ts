import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class SafariCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(value.Title, "--");
      cipher.login.username = this.getValueOrDefault(value.Username);
      cipher.login.password = this.getValueOrDefault(value.Password);
      cipher.login.uris = this.makeUriArray(value.Url ?? value.URL);
      cipher.login.totp = this.getValueOrDefault(value.OTPAuth);
      cipher.notes = this.getValueOrDefault(value.Notes);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
