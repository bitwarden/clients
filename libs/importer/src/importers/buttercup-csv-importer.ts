import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

const OfficialProps = ["!group_id", "!group_name", "title", "username", "password", "URL", "id"];

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
      cipher.login.uris = this.makeUriArray(value.URL);

      let processingCustomFields = false;
      for (const prop in value) {
        // eslint-disable-next-line
        if (value.hasOwnProperty(prop)) {
          if (!processingCustomFields && OfficialProps.indexOf(prop) === -1) {
            processingCustomFields = true;
          }
          if (processingCustomFields) {
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
