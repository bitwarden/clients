// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class GnomeJsonImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = JSON.parse(data);
    if (results == null || Object.keys(results).length === 0) {
      result.success = false;
      return Promise.resolve(result);
    }

    for (const keyRing in results) {
      if (
        !results.hasOwnProperty(keyRing) || // eslint-disable-line
        this.isNullOrWhitespace(keyRing) ||
        results[keyRing].length === 0
      ) {
        continue;
      }

      results[keyRing].forEach((value: any) => {
        if (
          this.isNullOrWhitespace(value.display_name) ||
          value.display_name.indexOf("http") !== 0
        ) {
          return;
        }

        this.processFolder(result, keyRing);
        const cipher = this.initLoginCipher();
        cipher.name = value.display_name.replace("http://", "").replace("https://", "");
        if (cipher.name.length > 30) {
          cipher.name = cipher.name.substring(0, 30);
        }
        cipher.login.password = this.getValueOrDefault(value.secret);
        cipher.login.uris = this.makeUriArray(value.display_name);

        if (value.attributes != null) {
          cipher.login.username =
            value.attributes != null
              ? this.getValueOrDefault(value.attributes.username_value)
              : null;
          for (const attr in value.attributes) {
            if (
              !value.attributes.hasOwnProperty(attr) || // eslint-disable-line
              attr === "username_value" ||
              attr === "xdg:schema"
            ) {
              continue;
            }
            this.processKvp(cipher, attr, value.attributes[attr]);
          }
        }

        this.convertToNoteIfNeeded(cipher);
        this.cleanupCipher(cipher);
        result.ciphers.push(cipher);
      });
    }

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }
}
