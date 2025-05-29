// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";

import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class PadlockCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, false);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    let headers: string[] = null;
    results.forEach((value) => {
      if (headers == null) {
        headers = value.map((v: string) => v);
        return;
      }

      if (value.length < 2 || value.length !== headers.length) {
        return;
      }

      if (!this.isNullOrWhitespace(value[1])) {
        if (this.organization) {
          const tags = (value[1] as string).split(",");
          tags.forEach((tag) => {
            tag = tag.trim();
            let addCollection = true;
            let collectionIndex = result.collections.length;

            for (let i = 0; i < result.collections.length; i++) {
              if (result.collections[i].name === tag) {
                addCollection = false;
                collectionIndex = i;
                break;
              }
            }

            if (addCollection) {
              const collection = new CollectionView();
              collection.name = tag;
              result.collections.push(collection);
            }

            result.collectionRelationships.push([result.ciphers.length, collectionIndex]);
          });
        } else {
          const tags = (value[1] as string).split(",");
          const tag = tags.length > 0 ? tags[0].trim() : null;
          this.processFolder(result, tag);
        }
      }

      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(value[0], "--");

      for (let i = 2; i < value.length; i++) {
        const header = headers[i].trim().toLowerCase();
        if (this.isNullOrWhitespace(value[i]) || this.isNullOrWhitespace(header)) {
          continue;
        }

        if (this.usernameFieldNames.indexOf(header) > -1) {
          cipher.login.username = value[i];
        } else if (this.passwordFieldNames.indexOf(header) > -1) {
          cipher.login.password = value[i];
        } else if (this.uriFieldNames.indexOf(header) > -1) {
          cipher.login.uris = this.makeUriArray(value[i]);
        } else {
          this.processKvp(cipher, headers[i], value[i]);
        }
      }

      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
