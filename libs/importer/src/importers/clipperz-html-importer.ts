// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FieldType } from "@bitwarden/common/vault/enums";

import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class ClipperzHtmlImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    // Clipperz exports are XHTML, but the only thing read out of them is the textarea's text
    // content. Parsing as HTML gets the same result without the XML parser rejecting the export's
    // XHTML DOCTYPE, and HTML parsing never resolves DTDs or entities.
    const doc = this.parseHtml(data);
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
        let passwordFieldIsLabeled = false;
        let passwordFieldLabel: string | null = null;
        for (const property in entry.currentVersion.fields) {
          // eslint-disable-next-line
          if (!entry.currentVersion.fields.hasOwnProperty(property)) {
            continue;
          }

          const field = entry.currentVersion.fields[property];
          const actionType = field.actionType != null ? field.actionType.toLowerCase() : null;
          // Clipperz marks "locked" fields with hidden: true; they must be
          // imported as hidden custom fields, never as plain text.
          const fieldType = field.hidden === true ? FieldType.Hidden : FieldType.Text;
          switch (actionType) {
            case "password": {
              const labelLower = field.label != null ? field.label.toLowerCase() : null;
              const labeled =
                labelLower != null && this.passwordFieldNames.indexOf(labelLower) > -1;
              if (cipher.login.password == null || (labeled && !passwordFieldIsLabeled)) {
                // Prefer a field actually labeled as a password: an earlier
                // unlabeled field that held the slot is demoted to a hidden
                // custom field rather than overwritten.
                if (cipher.login.password != null && passwordFieldLabel != null) {
                  this.processKvp(
                    cipher,
                    passwordFieldLabel,
                    cipher.login.password,
                    FieldType.Hidden,
                  );
                }
                cipher.login.password = this.getValueOrDefault(field.value);
                passwordFieldIsLabeled = labeled;
                passwordFieldLabel = field.label;
              } else {
                this.processKvp(cipher, field.label, field.value, fieldType);
              }
              break;
            }
            case "email":
            case "username":
            case "user":
            case "name":
              if (cipher.login.username == null) {
                cipher.login.username = this.getValueOrDefault(field.value);
              } else {
                this.processKvp(cipher, field.label, field.value, fieldType);
              }
              break;
            case "url":
              if (cipher.login.uris == null || cipher.login.uris.length === 0) {
                cipher.login.uris = this.makeUriArray(field.value);
              } else {
                this.processKvp(cipher, field.label, field.value, fieldType);
              }
              break;
            default: {
              const labelLower = field.label != null ? field.label.toLowerCase() : null;
              if (
                cipher.login.password == null &&
                this.passwordFieldNames.indexOf(labelLower) > -1
              ) {
                cipher.login.password = this.getValueOrDefault(field.value);
                passwordFieldIsLabeled = true;
                passwordFieldLabel = field.label;
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
                this.processKvp(cipher, field.label, field.value, fieldType);
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
