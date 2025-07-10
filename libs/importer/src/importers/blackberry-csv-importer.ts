import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class BlackBerryCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      if (value.grouping === "list") {
        return;
      }
      const cipher = this.initLoginCipher();
      cipher.favorite = value.fav === "1";
      cipher.name = this.getValueOrDefault(value.name);
      cipher.notes = this.getValueOrDefault(value.extra);
      if (value.grouping !== "note") {
        cipher.login.uris = this.makeUriArray(value.url);
        cipher.login.password = this.getValueOrDefault(value.password);
        cipher.login.username = this.getValueOrDefault(value.username);
      }
      this.convertToNoteIfNeeded(cipher);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
