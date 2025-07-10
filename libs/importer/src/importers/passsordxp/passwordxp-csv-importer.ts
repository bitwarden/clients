import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

const _mappedColumns = new Set(["Title", "Username", "URL", "Password", "Description"]);
import { dutchHeaderTranslations } from "./dutch-csv-headers";
import { germanHeaderTranslations } from "./german-csv-headers";

/* Translates the headers from non-English to English
 * This is necessary because the parser only maps English headers to ciphers
 * Currently only supports German and Dutch translations
 */
function translateIntoEnglishHeaders(header: string): string {
  const translations: { [key: string]: string } = {
    // The header column 'User name' is parsed by the parser, but cannot be used as a variable. This converts it to a valid variable name, prior to parsing.
    "User name": "Username",
    ...germanHeaderTranslations,
    ...dutchHeaderTranslations,
  };

  return translations[header] || header;
}

/**
 * PasswordXP CSV importer
 */
export class PasswordXPCsvImporter extends BaseImporter implements Importer {
  /**
   * Parses the PasswordXP CSV data.
   * @param data
   */
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true, {
      skipEmptyLines: true,
      transformHeader: translateIntoEnglishHeaders,
    });
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    // If the first row (header check) does not contain the column "Title", then the data is invalid (no translation found)
    if (!results[0].Title) {
      result.success = false;
      return Promise.resolve(result);
    }

    let currentFolderName = "";
    results.forEach((row) => {
      // Skip rows starting with '>>>' as they indicate items following have no folder assigned to them
      if (row.Title == ">>>") {
        return;
      }

      const title = row.Title;
      // If the title is in the format [title], then it is a folder name
      if (title.startsWith("[") && title.endsWith("]")) {
        currentFolderName = title.startsWith("/")
          ? title.replace("/", "")
          : title.substring(1, title.length - 1);
        return;
      }

      if (!Utils.isNullOrWhitespace(currentFolderName)) {
        this.processFolder(result, currentFolderName);
      }

      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(row.Title);
      cipher.login.username = this.getValueOrDefault(row.Username);
      cipher.notes = this.getValueOrDefault(row.Description);
      cipher.login.uris = this.makeUriArray(row.URL);
      cipher.login.password = this.getValueOrDefault(row.Password);

      this.importUnmappedFields(cipher, row, _mappedColumns);

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

  private importUnmappedFields(cipher: CipherView, row: any, mappedValues: Set<string>) {
    const unmappedFields = Object.keys(row).filter((x) => !mappedValues.has(x));
    unmappedFields.forEach((key) => {
      const item = row as any;
      this.processKvp(cipher, key, item[key]);
    });
  }
}
