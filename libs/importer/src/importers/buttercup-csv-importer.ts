import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

const OfficialProps = [
  "!group_id",
  "!group_name",
  "!type",
  "title",
  "username",
  "password",
  "URL",
  "url",
  "note",
  "id",
];

export class ButtercupCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      this.processFolder(result, this.getValueOrDefault(value["!group_name"]));

      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(value.title, "--");
      cipher.login.username = this.getValueOrDefault(value.username);
      cipher.login.password = this.getValueOrDefault(value.password);

      // Handle URL field (case-insensitive)
      const urlValue = value.URL || value.url || value.Url;
      cipher.login.uris = this.makeUriArray(urlValue);

      // Handle note field (case-insensitive)
      const noteValue = value.note || value.Note || value.notes || value.Notes;
      if (noteValue) {
        cipher.notes = noteValue;
      }

      // Process custom fields, excluding official props (case-insensitive)
      for (const prop in value) {
        // eslint-disable-next-line
        if (value.hasOwnProperty(prop)) {
          const lowerProp = prop.toLowerCase();
          const isOfficialProp = OfficialProps.some((p) => p.toLowerCase() === lowerProp);
          if (!isOfficialProp && value[prop]) {
            this.processKvp(cipher, prop, value[prop]);
          }
        }
      }

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
