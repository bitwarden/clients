// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class SecureSafeCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    // importer expects these column headers: Title,Username,Password,URL,Comment
    // using a map of headers in different languages to prevent issue in non-english languages
    const headerMap: { [key: string]: string[] } = {
      Title: ['title', 'titel', 'titre'],
      Username: ['username', 'benutzername', "nom d'utilisateur"],
      Password: ['password', 'passwort', 'mot de passe'],
      URL: ['url'],
      Comment: ['comment', 'kommentar', 'commentaire']
    };

    // Creating a helper function that will take an input from the parsed string and check if it is found in the map, assigning the expected key in english
    function mapConversion(colHeader: string): string | null {
      // covering upper/lower case errors
      colHeader = colHeader.toLowerCase(); 
      for (const key in headerMap) {
        if (headerMap[key].includes(colHeader)) {
          return key;
        }
      }
      return null;
    }

    // The url field can be in different case formats.
    const urlField = Object.keys(results[0]).find((k) => /url/i.test(k));
    results.forEach((value) => {
      const cipher = this.initLoginCipher();

      // Iterating through each col in the current header
      Object.keys(value).forEach((colHeader) => {
        const convertedHeader = mapConversion(colHeader);

        if (convertedHeader) {
          // using switch cases to handle different parts of cipher header based on the returned key
          switch (convertedHeader) {
            case 'Title':
              cipher.name = this.getValueOrDefault(value[colHeader]);
              break;
            case 'Username':
              cipher.login.username = this.getValueOrDefault(value[colHeader]);
              break;
            case 'Password':
              cipher.login.password = this.getValueOrDefault(value[colHeader]);
              break;
            case 'URL':
              cipher.login.uris = this.makeUriArray(value[urlField]);
              break;
            case 'Comment':
              cipher.notes = this.getValueOrDefault(value[colHeader]);
              break;
            // protective case in situation where invalid header is present
            default:
              result.success = false;
              return Promise.resolve(result);
          }
        } else {
          result.success = false;
          return Promise.resolve(result);
        }
      });
      
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
