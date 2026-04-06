import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class CodebookCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      this.processFolder(result, this.getValueOrDefault(value.Category));

      const cipher = this.initLoginCipher();
      cipher.favorite = this.getValueOrDefault(value.Favorite) === "True";
      cipher.name = this.getValueOrDefault(value.Entry, "--");
      cipher.notes = this.getValueOrDefault(value.Note);
      cipher.login.username = this.getValueOrDefault(value.Username, value.Email);
      cipher.login.password = this.getValueOrDefault(value.Password);
      cipher.login.totp = this.getValueOrDefault(value.TOTP);
      cipher.login.uris = this.makeUriArray(value.Website);

      if (!this.isNullOrWhitespace(value.Username)) {
        this.processKvp(cipher, "Email", value.Email);
      }
      this.processKvp(cipher, "Phone", value.Phone);
      this.processKvp(cipher, "PIN", value.PIN);
      this.processKvp(cipher, "Account", value.Account);
      this.processKvp(cipher, "Date", value.Date);

      this.convertToNoteIfNeeded(cipher);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }
}
