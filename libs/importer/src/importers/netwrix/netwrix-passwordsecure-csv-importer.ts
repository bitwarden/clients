import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

import { LoginRecord } from "./netwrix-passwordsecure-csv-types";

const _mappedColumns = new Set([
  "Organisationseinheit",
  "Informationen",
  "Beschreibung",
  "Benutzername",
  "Passwort",
  "Internetseite",
  "One-Time Passwort",
]);

/**
 * Importer for Netwrix Password Secure CSV files.
 * @see https://www.netwrix.com/enterprise_password_management_software.html
 */
export class NetwrixPasswordSecureCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((row: LoginRecord) => {
      this.processFolder(result, row.Organisationseinheit);
      const cipher = this.initLoginCipher();

      const notes = this.getValueOrDefault(row.Informationen);
      if (notes) {
        cipher.notes = `${notes}\n`;
      }

      cipher.name = this.getValueOrDefault(row.Beschreibung, "--");
      cipher.login.username = this.getValueOrDefault(row.Benutzername);
      cipher.login.password = this.getValueOrDefault(row.Passwort);
      cipher.login.uris = this.makeUriArray(row.Internetseite);

      cipher.login.totp = this.getValueOrDefault(row["One-Time Passwort"]);

      this.importUnmappedFields(cipher, row, _mappedColumns);

      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }

  private importUnmappedFields(cipher: CipherView, row: any, mappedValues: Set<string>) {
    const unmappedFields = Object.keys(row).filter((x) => !mappedValues.has(x));
    unmappedFields.forEach((key) => {
      const item = row as any;
      this.processKvp(cipher, key, item[key]);
    });
  }
}
