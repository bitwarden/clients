import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class KeePassXCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      if (this.isNullOrWhitespace(value.Title)) {
        return;
      }

      value.Group =
        !this.isNullOrWhitespace(value.Group) && value.Group.startsWith("Root/")
          ? value.Group.replace("Root/", "")
          : value.Group;
      const groupName = !this.isNullOrWhitespace(value.Group) ? value.Group : null;
      this.processFolder(result, groupName);

      const cipher = this.initLoginCipher();
      cipher.notes = this.getValueOrDefault(value.Notes);
      cipher.name = this.getValueOrDefault(value.Title, "--");
      cipher.login.username = this.getValueOrDefault(value.Username);
      cipher.login.password = this.getValueOrDefault(value.Password);
      cipher.login.uris = this.makeUriArray(value.URL);
      cipher.login.totp = this.getValueOrDefault(value.TOTP);

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
