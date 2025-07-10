import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class AscendoCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, false);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      if (value.length < 2) {
        return;
      }

      const cipher = this.initLoginCipher();
      cipher.notes = this.getValueOrDefault(value[value.length - 1]);
      cipher.name = this.getValueOrDefault(value[0], "--");

      if (value.length > 2 && value.length % 2 === 0) {
        for (let i = 0; i < value.length - 2; i += 2) {
          const val: string = value[i + 2];
          const field: string = value[i + 1];
          if (this.isNullOrWhitespace(val) || this.isNullOrWhitespace(field)) {
            continue;
          }

          const fieldLower = field.toLowerCase();
          if (cipher.login.password == null && this.passwordFieldNames.indexOf(fieldLower) > -1) {
            cipher.login.password = this.getValueOrDefault(val);
          } else if (
            cipher.login.username == null &&
            this.usernameFieldNames.indexOf(fieldLower) > -1
          ) {
            cipher.login.username = this.getValueOrDefault(val);
          } else if (
            (cipher.login.uris == null || cipher.login.uris.length === 0) &&
            this.uriFieldNames.indexOf(fieldLower) > -1
          ) {
            cipher.login.uris = this.makeUriArray(val);
          } else {
            this.processKvp(cipher, field, val);
          }
        }
      }

      this.convertToNoteIfNeeded(cipher);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
