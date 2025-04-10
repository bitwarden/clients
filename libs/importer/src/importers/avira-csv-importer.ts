// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class AviraCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(
        value.name,
        this.getValueOrDefault(this.nameFromUrl(value.website), "--"),
      );
      cipher.login.uris = this.makeUriArray(value.website);
      cipher.login.password = this.getValueOrDefault(value.password);

      if (
        this.isNullOrWhitespace(value.username) &&
        !this.isNullOrWhitespace(value.secondary_username)
      ) {
        cipher.login.username = value.secondary_username;
      } else {
        cipher.login.username = this.getValueOrDefault(value.username);
        cipher.notes = this.getValueOrDefault(value.secondary_username);
      }

      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
