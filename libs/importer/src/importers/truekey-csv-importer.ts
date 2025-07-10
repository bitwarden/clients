import { SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

const PropertiesToIgnore = [
  "kind",
  "autologin",
  "favorite",
  "hexcolor",
  "protectedwithpassword",
  "subdomainonly",
  "type",
  "tk_export_version",
  "note",
  "title",
  "document_content",
];

export class TrueKeyCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      const cipher = this.initLoginCipher();
      cipher.favorite = this.getValueOrDefault(value.favorite, "").toLowerCase() === "true";
      cipher.name = this.getValueOrDefault(value.name, "--");
      cipher.notes = this.getValueOrDefault(value.memo, "");
      cipher.login.username = this.getValueOrDefault(value.login);
      cipher.login.password = this.getValueOrDefault(value.password);
      cipher.login.uris = this.makeUriArray(value.url);

      if (value.kind !== "login") {
        cipher.name = this.getValueOrDefault(value.title, "--");
        cipher.notes = this.getValueOrDefault(value.note, "");
      }

      if (value.kind === "cc") {
        cipher.type = CipherType.Card;
        cipher.card = new CardView();
        cipher.card.cardholderName = this.getValueOrDefault(value.cardholder);
        cipher.card.number = this.getValueOrDefault(value.number);
        cipher.card.brand = CardView.getCardBrandByPatterns(cipher.card.number);
        if (!this.isNullOrWhitespace(value.expiryDate)) {
          try {
            const expDate = new Date(value.expiryDate);
            cipher.card.expYear = expDate.getFullYear().toString();
            cipher.card.expMonth = (expDate.getMonth() + 1).toString();
          } catch {
            // Ignore error
          }
        }
      } else if (value.kind !== "login") {
        cipher.type = CipherType.SecureNote;
        cipher.secureNote = new SecureNoteView();
        cipher.secureNote.type = SecureNoteType.Generic;
        if (!this.isNullOrWhitespace(cipher.notes)) {
          cipher.notes = this.getValueOrDefault(value.document_content, "");
        }
        for (const property in value) {
          if (
            value.hasOwnProperty(property) && // eslint-disable-line
            PropertiesToIgnore.indexOf(property.toLowerCase()) < 0 &&
            !this.isNullOrWhitespace(value[property])
          ) {
            this.processKvp(cipher, property, value[property]);
          }
        }
      }

      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
