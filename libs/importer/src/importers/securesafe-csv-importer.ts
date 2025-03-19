// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class SecureSafeCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    // The url field can be in different case formats.
    const urlField = Object.keys(results[0]).find((k) => /url/i.test(k));
    results.forEach((value) => {
      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(value.Title);
      cipher.notes = this.getValueOrDefault(value.Comment);
      cipher.login.uris = this.makeUriArray(value[urlField]);
      cipher.login.password = this.getValueOrDefault(value.Password);
      cipher.login.username = this.getValueOrDefault(value.Username);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
