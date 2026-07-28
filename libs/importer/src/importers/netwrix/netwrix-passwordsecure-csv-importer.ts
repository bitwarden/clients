import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

import { LoginRecord } from "./netwrix-passwordsecure-csv-types";

// Netwrix Password Secure exports the same logical field under different column headers depending
// on the export's language/version. Each logical field lists every known header; the first column
// that is present and non-empty for a given row is used. Add new aliases here as they surface.
const _folderColumns: (keyof LoginRecord)[] = ["Organisationseinheit", "Organisational unit"];
const _nameColumns: (keyof LoginRecord)[] = ["Beschreibung"];
const _usernameColumns: (keyof LoginRecord)[] = ["Benutzername"];
const _passwordColumns: (keyof LoginRecord)[] = ["Passwort"];
const _uriColumns: (keyof LoginRecord)[] = [
  "Internetseite",
  "Internetadresse",
  "Webseite",
  "Webseite1",
  "Website",
  "Webmail",
  "Web page",
  "URL",
];
const _notesColumns: (keyof LoginRecord)[] = ["Informationen", "Kommentare"];
const _totpColumns: (keyof LoginRecord)[] = ["One-Time Passwort"];

// Columns that map to a cipher property. Anything else (e.g. DataTags, EMail-Adresse) is preserved
// as a custom field by importUnmappedFields.
const _mappedColumns = new Set<string>([
  ..._folderColumns,
  ..._nameColumns,
  ..._usernameColumns,
  ..._passwordColumns,
  ..._uriColumns,
  ..._notesColumns,
  ..._totpColumns,
]);

// Netwrix uses a semicolon delimiter. Setting it explicitly avoids papaparse's delimiter
// auto-detection, which fails on exports where each row is wrapped in an extra layer of quotes.
const _delimiter = ";";

/**
 * Importer for Netwrix Password Secure CSV files.
 * @see https://www.netwrix.com/enterprise_password_management_software.html
 */
export class NetwrixPasswordSecureCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    let results = this.parseCsv(data, true, { delimiter: _delimiter });
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results = this.unwrapEnclosingQuotes(results);

    results.forEach((row: LoginRecord) => {
      this.processFolder(result, this.firstPopulated(row, _folderColumns));
      const cipher = this.initLoginCipher();

      const notes = this.getValueOrDefault(this.firstPopulated(row, _notesColumns));
      if (notes) {
        cipher.notes = notes.trimEnd();
      }

      cipher.name = this.getValueOrDefault(this.firstPopulated(row, _nameColumns), "--");
      cipher.login.username = this.getValueOrDefault(this.firstPopulated(row, _usernameColumns));
      cipher.login.password = this.getValueOrDefault(this.firstPopulated(row, _passwordColumns));
      cipher.login.uris = this.makeUriArray(
        _uriColumns.map((column) => row[column]).filter((value) => value != null),
      );

      cipher.login.totp = this.getValueOrDefault(this.firstPopulated(row, _totpColumns));

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

  /**
   * Some Netwrix exports (e.g. those produced by scripts) wrap each entire row in an extra layer of
   * CSV quoting, doubling the inner quotes: `"Organisationseinheit;""DataTags"";..."`. papaparse
   * then reads the whole line as a single field, so every expected column comes back undefined.
   *
   * This detects that case — a single column whose header still contains the delimiter — and
   * re-parses the already-unwrapped values (papaparse strips one quote layer when parsing the
   * single field), restoring the standard column layout. Well-formed exports are returned as-is.
   */
  private unwrapEnclosingQuotes(rows: LoginRecord[]): LoginRecord[] {
    const columns = Object.keys(rows[0]);
    if (columns.length !== 1 || !columns[0].includes(_delimiter)) {
      return rows;
    }

    const headerLine = columns[0];
    const lines = [headerLine, ...rows.map((row) => (row as any)[headerLine])].join("\n");
    // parseCsv returns null when the re-parse yields no data rows (e.g. every wrapped row is empty
    // and gets trimmed away). Fall back to the original rows so parse() never iterates over null.
    return this.parseCsv(lines, true, { delimiter: _delimiter }) ?? rows;
  }

  /**
   * Returns the value of the first candidate column that is present and non-empty, or an empty
   * string if none are. Pass the result through getValueOrDefault to apply a fallback.
   */
  private firstPopulated(row: LoginRecord, columns: (keyof LoginRecord)[]): string {
    const column = columns.find((candidate) => !this.isNullOrWhitespace(row[candidate]));
    return column == null ? "" : row[column];
  }

  private importUnmappedFields(cipher: CipherView, row: any, mappedValues: Set<string>) {
    const unmappedFields = Object.keys(row).filter((x) => !mappedValues.has(x));
    unmappedFields.forEach((key) => {
      const item = row as any;
      this.processKvp(cipher, key, item[key]);
    });
  }
}
