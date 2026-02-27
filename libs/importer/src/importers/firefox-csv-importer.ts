// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class FirefoxCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results
      .filter((value) => {
        return value.url !== "chrome://FirefoxAccounts";
      })
      .forEach((value) => {
        const cipher = this.initLoginCipher();
        const url = this.getValueOrDefault(value.url, this.getValueOrDefault(value.hostname));
        cipher.name = this.getValueOrDefault(this.nameFromUrl(url), "--");
        cipher.login.username = this.getValueOrDefault(value.username);
        cipher.login.password = this.getValueOrDefault(value.password);
        cipher.login.uris = this.makeUriArray(url);
        this.cleanupCipher(cipher);
        result.ciphers.push(cipher);
      });

    result.success = true;
    return Promise.resolve(result);
  }
}
