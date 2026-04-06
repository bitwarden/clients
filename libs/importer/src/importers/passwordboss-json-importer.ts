// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CipherType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class PasswordBossJsonImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = JSON.parse(data);
    if (results == null || results.items == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    const foldersMap = new Map<string, string>();
    results.folders.forEach((value: any) => {
      foldersMap.set(value.id, value.name);
    });
    const foldersIndexMap = new Map<string, number>();
    foldersMap.forEach((val, key) => {
      foldersIndexMap.set(key, result.folders.length);
      const f = new FolderView();
      f.name = val;
      result.folders.push(f);
    });

    results.items.forEach((value: any) => {
      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(value.name, "--");
      cipher.login.uris = this.makeUriArray(value.login_url);

      if (value.folder != null && foldersIndexMap.has(value.folder)) {
        result.folderRelationships.push([result.ciphers.length, foldersIndexMap.get(value.folder)]);
      }

      if (value.identifiers == null) {
        return;
      }

      if (!this.isNullOrWhitespace(value.identifiers.notes)) {
        cipher.notes = value.identifiers.notes.split("\\r\\n").join("\n").split("\\n").join("\n");
      }

      if (value.type === "CreditCard") {
        cipher.card = new CardView();
        cipher.type = CipherType.Card;
      }

      for (const property in value.identifiers) {
        // eslint-disable-next-line
        if (!value.identifiers.hasOwnProperty(property)) {
          continue;
        }
        const valObj = value.identifiers[property];
        const val = valObj != null ? valObj.toString() : null;
        if (
          this.isNullOrWhitespace(val) ||
          property === "notes" ||
          property === "ignoreItemInSecurityScore"
        ) {
          continue;
        }

        if (property === "custom_fields") {
          valObj.forEach((cf: any) => {
            this.processKvp(cipher, cf.name, cf.value);
          });
          continue;
        }

        if (cipher.type === CipherType.Card) {
          if (property === "cardNumber") {
            cipher.card.number = val;
            cipher.card.brand = CardView.getCardBrandByPatterns(cipher.card.number);
            continue;
          } else if (property === "nameOnCard") {
            cipher.card.cardholderName = val;
            continue;
          } else if (property === "security_code") {
            cipher.card.code = val;
            continue;
          } else if (property === "expires") {
            try {
              const expDate = new Date(val);
              cipher.card.expYear = expDate.getFullYear().toString();
              cipher.card.expMonth = (expDate.getMonth() + 1).toString();
            } catch {
              // Ignore error
            }
            continue;
          } else if (property === "cardType") {
            continue;
          }
        } else {
          if (
            (property === "username" || property === "email") &&
            this.isNullOrWhitespace(cipher.login.username)
          ) {
            cipher.login.username = val;
            continue;
          } else if (property === "password") {
            cipher.login.password = val;
            continue;
          } else if (property === "totp") {
            cipher.login.totp = val;
            continue;
          } else if (
            (cipher.login.uris == null || cipher.login.uris.length === 0) &&
            this.uriFieldNames.indexOf(property) > -1
          ) {
            cipher.login.uris = this.makeUriArray(val);
            continue;
          }
        }

        this.processKvp(cipher, property, val);
      }

      this.convertToNoteIfNeeded(cipher);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
