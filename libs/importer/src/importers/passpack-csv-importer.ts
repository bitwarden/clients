// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";

import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class PasspackCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      const tagsJson = !this.isNullOrWhitespace(value.Tags) ? JSON.parse(value.Tags) : null;
      const tags: string[] =
        tagsJson != null && tagsJson.tags != null && tagsJson.tags.length > 0
          ? tagsJson.tags
              .map((tagJson: string) => {
                try {
                  const t = JSON.parse(tagJson);
                  return this.getValueOrDefault(t.tag);
                } catch {
                  // Ignore error
                }
                return null;
              })
              .filter((t: string) => !this.isNullOrWhitespace(t))
          : null;

      if (this.organization && tags != null && tags.length > 0) {
        tags.forEach((tag) => {
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
      } else if (!this.organization && tags != null && tags.length > 0) {
        this.processFolder(result, tags[0]);
      }

      const cipher = this.initLoginCipher();
      cipher.notes = this.getValueOrDefault(value.Notes, "");
      cipher.notes += "\n\n" + this.getValueOrDefault(value["Shared Notes"], "") + "\n";
      cipher.name = this.getValueOrDefault(value["Entry Name"], "--");
      cipher.login.username = this.getValueOrDefault(value["User ID"]);
      cipher.login.password = this.getValueOrDefault(value.Password);
      cipher.login.uris = this.makeUriArray(value.URL);

      if (value.__parsed_extra != null && value.__parsed_extra.length > 0) {
        value.__parsed_extra.forEach((extra: string) => {
          if (!this.isNullOrWhitespace(extra)) {
            cipher.notes += "\n" + extra;
          }
        });
      }

      const fieldsJson = !this.isNullOrWhitespace(value["Extra Fields"])
        ? JSON.parse(value["Extra Fields"])
        : null;
      const fields =
        fieldsJson != null && fieldsJson.extraFields != null && fieldsJson.extraFields.length > 0
          ? fieldsJson.extraFields.map((fieldJson: string) => {
              try {
                return JSON.parse(fieldJson);
              } catch {
                // Ignore error
              }
              return null;
            })
          : null;
      if (fields != null) {
        fields.forEach((f: any) => {
          if (f != null) {
            this.processKvp(cipher, f.name, f.data);
          }
        });
      }

      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
