// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class BlurCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      if (value.label === "null") {
        value.label = null;
      }
      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(
        value.label,
        this.getValueOrDefault(this.nameFromUrl(value.domain), "--"),
      );
      cipher.login.uris = this.makeUriArray(value.domain);
      cipher.login.password = this.getValueOrDefault(value.password);

      if (this.isNullOrWhitespace(value.email) && !this.isNullOrWhitespace(value.username)) {
        cipher.login.username = value.username;
      } else {
        cipher.login.username = this.getValueOrDefault(value.email);
        cipher.notes = this.getValueOrDefault(value.username);
      }

      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
