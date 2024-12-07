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

    // SecureSafe currently exports values in multiple languages. - 09/05/2024
    // New headers are used to ensure import success.
    const newHeaders = ["Title", "Username", "Password", "URL", "Comment"];

    // SecureSafe can surround values in slashes. - 09/05/2024
    // This removes any surrounding slashes from the values.
    const headers = Object.keys(results[0]);
    const remappedResults = results.map((row) => {
      const remappedRow: any = {};
      newHeaders.forEach((header, index) => {
        let value = row[headers[index]];
        if (typeof value === "string" && value.startsWith("/") && value.endsWith("/")) {
          value = value.slice(1, -1);
        }
        remappedRow[header] = value;
      });
      return remappedRow;
    });

    // The url field can be in different case formats.
    const urlField = Object.keys(remappedResults[0]).find((k) => /url/i.test(k));
    remappedResults.forEach((value) => {
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
