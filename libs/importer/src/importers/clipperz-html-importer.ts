// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class ClipperzHtmlImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const doc = this.parseXml(data);
    if (doc == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    const textarea = doc.querySelector("textarea");
    if (textarea == null || this.isNullOrWhitespace(textarea.textContent)) {
      result.errorMessage = "Missing textarea.";
      result.success = false;
      return Promise.resolve(result);
    }

    const entries = JSON.parse(textarea.textContent);
    entries.forEach((entry: any) => {
      const cipher = this.initLoginCipher();
      if (!this.isNullOrWhitespace(entry.label)) {
        cipher.name = entry.label.split(" ")[0];
      }
      if (entry.data != null && !this.isNullOrWhitespace(entry.data.notes)) {
        cipher.notes = entry.data.notes.split("\\n").join("\n");
      }

      if (entry.currentVersion != null && entry.currentVersion.fields != null) {
        for (const property in entry.currentVersion.fields) {
          // eslint-disable-next-line
          if (!entry.currentVersion.fields.hasOwnProperty(property)) {
            continue;
          }

          const field = entry.currentVersion.fields[property];
          const actionType = field.actionType != null ? field.actionType.toLowerCase() : null;
          switch (actionType) {
            case "password":
              cipher.login.password = this.getValueOrDefault(field.value);
              break;
            case "email":
            case "username":
            case "user":
            case "name":
              cipher.login.username = this.getValueOrDefault(field.value);
              break;
            case "url":
              cipher.login.uris = this.makeUriArray(field.value);
              break;
            default: {
              const labelLower = field.label != null ? field.label.toLowerCase() : null;
              if (
                cipher.login.password == null &&
                this.passwordFieldNames.indexOf(labelLower) > -1
              ) {
                cipher.login.password = this.getValueOrDefault(field.value);
              } else if (
                cipher.login.username == null &&
                this.usernameFieldNames.indexOf(labelLower) > -1
              ) {
                cipher.login.username = this.getValueOrDefault(field.value);
              } else if (
                (cipher.login.uris == null || cipher.login.uris.length === 0) &&
                this.uriFieldNames.indexOf(labelLower) > -1
              ) {
                cipher.login.uris = this.makeUriArray(field.value);
              } else {
                this.processKvp(cipher, field.label, field.value);
              }
              break;
            }
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
