// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class ZohoVaultCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }
    results.forEach((value) => {
      if (
        this.isNullOrWhitespace(value["Password Name"]) &&
        this.isNullOrWhitespace(value["Secret Name"])
      ) {
        return;
      }
      this.processFolder(result, this.getValueOrDefault(value["Folder Name"]));
      const cipher = this.initLoginCipher();
      cipher.favorite = this.getValueOrDefault(value.Favorite, "0") === "1";
      cipher.notes = this.getValueOrDefault(value.Notes);
      cipher.name = this.getValueOrDefault(
        value["Password Name"],
        this.getValueOrDefault(value["Secret Name"], "--"),
      );
      cipher.login.uris = this.makeUriArray(
        this.getValueOrDefault(value["Password URL"], this.getValueOrDefault(value["Secret URL"])),
      );
      cipher.login.totp = this.getValueOrDefault(value["login_totp"]);
      this.parseData(cipher, value.SecretData);
      this.parseData(cipher, value.CustomData);
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

  private parseData(cipher: CipherView, data: string) {
    if (this.isNullOrWhitespace(data)) {
      return;
    }
    const dataLines = this.splitNewLine(data);
    dataLines.forEach((line) => {
      const delimPosition = line.indexOf(":");
      if (delimPosition < 0) {
        return;
      }
      const field = line.substring(0, delimPosition);
      const value = line.length > delimPosition ? line.substring(delimPosition + 1) : null;
      if (
        this.isNullOrWhitespace(field) ||
        this.isNullOrWhitespace(value) ||
        field === "SecretType"
      ) {
        return;
      }
      const fieldLower = field.toLowerCase();
      if (cipher.login.username == null && this.usernameFieldNames.indexOf(fieldLower) > -1) {
        cipher.login.username = value;
      } else if (
        cipher.login.password == null &&
        this.passwordFieldNames.indexOf(fieldLower) > -1
      ) {
        cipher.login.password = value;
      } else {
        this.processKvp(cipher, field, value);
      }
    });
  }
}
