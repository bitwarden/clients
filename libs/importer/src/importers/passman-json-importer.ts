import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class PassmanJsonImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = JSON.parse(data);
    if (results == null || results.length === 0) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((credential: any) => {
      if (credential.tags != null && credential.tags.length > 0) {
        const folderName = credential.tags[0].text;
        this.processFolder(result, folderName);
      }

      const cipher = this.initLoginCipher();
      cipher.name = credential.label;

      cipher.login.username = this.getValueOrDefault(credential.username);
      if (this.isNullOrWhitespace(cipher.login.username)) {
        cipher.login.username = this.getValueOrDefault(credential.email);
      } else if (!this.isNullOrWhitespace(credential.email)) {
        cipher.notes = "Email: " + credential.email + "\n";
      }

      cipher.login.password = this.getValueOrDefault(credential.password);
      cipher.login.uris = this.makeUriArray(credential.url);
      cipher.notes += this.getValueOrDefault(credential.description, "");
      if (credential.otp != null) {
        cipher.login.totp = this.getValueOrDefault(credential.otp.secret);
      }

      if (credential.custom_fields != null) {
        credential.custom_fields.forEach((customField: any) => {
          switch (customField.field_type) {
            case "text":
            case "password":
              this.processKvp(cipher, customField.label, customField.value);
              break;
          }
        });
      }

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
