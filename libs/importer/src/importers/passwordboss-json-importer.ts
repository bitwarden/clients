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
    const results = JSON.parse(data);

    // Current export ("Password Boss JSON - Not Encrypted"): a flat array of items, with card/login
    // fields living directly on each item rather than nested under `identifiers`, and no separate
    // top-level `folders` list — each item names its own folder (if any) directly.
    if (Array.isArray(results)) {
      return Promise.resolve(this.parseFlatItems(results));
    }

    // Older export shape, kept for anyone importing a backup made before Password Boss changed
    // its export format: a top-level object with `items` and `folders` arrays, and each item's
    // fields nested under `identifiers`.
    return Promise.resolve(this.parseLegacyExport(results));
  }

  // Fields consumed explicitly below, or intentionally discarded (id/itemType/logoColor are
  // presentational, cardType is redundant with the brand detected from cardNumber).
  private readonly flatItemHandledKeys = new Set([
    "id",
    "itemType",
    "itemTypeName",
    "logoColor",
    "folder",
    "name",
    "notes",
    "customFields",
    "tags",
    "url",
    "username",
    "password",
    "totp",
    "email",
    "cardNumber",
    "nameOnCard",
    "securityCode",
    "expirationDate",
    "cardType",
    "issuingBank",
    "issueDate",
    "pin",
  ]);

  private parseFlatItems(items: any[]): ImportResult {
    const result = new ImportResult();

    items.forEach((value: any) => {
      const isCard = value.itemTypeName === "CreditCard";
      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(value.name, "--");

      if (isCard) {
        cipher.card = new CardView();
        cipher.type = CipherType.Card;
      }

      this.processFolder(result, value.folder);

      if (!this.isNullOrWhitespace(value.notes)) {
        cipher.notes = value.notes;
      }

      if (isCard) {
        cipher.card.number = this.getValueOrDefault(value.cardNumber);
        if (cipher.card.number != null) {
          cipher.card.brand = CardView.getCardBrandByPatterns(cipher.card.number);
        }
        cipher.card.cardholderName = this.getValueOrDefault(value.nameOnCard);
        cipher.card.code = this.getValueOrDefault(value.securityCode);
        if (!this.isNullOrWhitespace(value.expirationDate)) {
          const expDate = new Date(value.expirationDate);
          if (!isNaN(expDate.getTime())) {
            cipher.card.expYear = expDate.getUTCFullYear().toString();
            cipher.card.expMonth = (expDate.getUTCMonth() + 1).toString();
          }
        }
        this.processKvp(cipher, "Issuing Bank", value.issuingBank);
        this.processKvp(cipher, "Issue Date", value.issueDate);
        this.processKvp(cipher, "PIN", value.pin);
      } else {
        cipher.login.uris = this.makeUriArray(value.url);
        cipher.login.username = this.getValueOrDefault(value.username);
        cipher.login.password = this.getValueOrDefault(value.password);
        if (
          this.isNullOrWhitespace(cipher.login.username) &&
          !this.isNullOrWhitespace(value.email)
        ) {
          cipher.login.username = value.email;
        }
        if (!this.isNullOrWhitespace(value.totp)) {
          cipher.login.totp = value.totp;
        }
      }

      if (Array.isArray(value.customFields)) {
        value.customFields.forEach((cf: any) => {
          this.processKvp(cipher, cf.name, cf.value);
        });
      }

      if (Array.isArray(value.tags) && value.tags.length > 0) {
        this.processKvp(cipher, "Tags", value.tags.join(", "));
      }

      // Anything Password Boss adds that we don't explicitly map above still ends up on the
      // cipher, instead of silently disappearing.
      for (const property in value) {
        if (
          !Object.prototype.hasOwnProperty.call(value, property) ||
          this.flatItemHandledKeys.has(property)
        ) {
          continue;
        }
        const val = value[property];
        this.processKvp(cipher, property, val != null ? val.toString() : null);
      }

      this.convertToNoteIfNeeded(cipher);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return result;
  }

  private parseLegacyExport(results: any): ImportResult {
    const result = new ImportResult();
    if (results == null || results.items == null) {
      result.success = false;
      return result;
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
    return result;
  }
}
