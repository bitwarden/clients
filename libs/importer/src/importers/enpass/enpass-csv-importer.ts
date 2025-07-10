import { SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

export class EnpassCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, false);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    let firstRow = true;
    results.forEach((value) => {
      if (value.length < 2 || (firstRow && (value[0] === "Title" || value[0] === "title"))) {
        firstRow = false;
        return;
      }

      const cipher = this.initLoginCipher();
      cipher.notes = this.getValueOrDefault(value[value.length - 1]);
      cipher.name = this.getValueOrDefault(value[0], "--");

      if (
        value.length === 2 ||
        (!this.containsField(value, "username") &&
          !this.containsField(value, "password") &&
          !this.containsField(value, "email") &&
          !this.containsField(value, "url"))
      ) {
        cipher.type = CipherType.SecureNote;
        cipher.secureNote = new SecureNoteView();
        cipher.secureNote.type = SecureNoteType.Generic;
      }

      if (
        this.containsField(value, "cardholder") &&
        this.containsField(value, "number") &&
        this.containsField(value, "expiry date")
      ) {
        cipher.type = CipherType.Card;
        cipher.card = new CardView();
      }

      if (value.length > 2 && value.length % 2 === 0) {
        for (let i = 0; i < value.length - 2; i += 2) {
          const fieldValue: string = value[i + 2];
          if (this.isNullOrWhitespace(fieldValue)) {
            continue;
          }

          const fieldName: string = value[i + 1];
          const fieldNameLower = fieldName.toLowerCase();

          if (cipher.type === CipherType.Login) {
            if (
              fieldNameLower === "url" &&
              (cipher.login.uris == null || cipher.login.uris.length === 0)
            ) {
              cipher.login.uris = this.makeUriArray(fieldValue);
              continue;
            } else if (
              (fieldNameLower === "username" || fieldNameLower === "email") &&
              this.isNullOrWhitespace(cipher.login.username)
            ) {
              cipher.login.username = fieldValue;
              continue;
            } else if (
              fieldNameLower === "password" &&
              this.isNullOrWhitespace(cipher.login.password)
            ) {
              cipher.login.password = fieldValue;
              continue;
            } else if (fieldNameLower === "totp" && this.isNullOrWhitespace(cipher.login.totp)) {
              cipher.login.totp = fieldValue;
              continue;
            }
          } else if (cipher.type === CipherType.Card) {
            if (
              fieldNameLower === "cardholder" &&
              this.isNullOrWhitespace(cipher.card.cardholderName)
            ) {
              cipher.card.cardholderName = fieldValue;
              continue;
            } else if (fieldNameLower === "number" && this.isNullOrWhitespace(cipher.card.number)) {
              cipher.card.number = fieldValue;
              cipher.card.brand = CardView.getCardBrandByPatterns(cipher.card.number);
              continue;
            } else if (fieldNameLower === "cvc" && this.isNullOrWhitespace(cipher.card.code)) {
              cipher.card.code = fieldValue;
              continue;
            } else if (
              fieldNameLower === "expiry date" &&
              this.isNullOrWhitespace(cipher.card.expMonth) &&
              this.isNullOrWhitespace(cipher.card.expYear)
            ) {
              if (this.setCardExpiration(cipher, fieldValue)) {
                continue;
              }
            } else if (fieldNameLower === "type") {
              // Skip since brand was determined from number above
              continue;
            }
          }

          this.processKvp(cipher, fieldName, fieldValue);
        }
      }

      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }

  private containsField(fields: any[], name: string) {
    if (fields == null || name == null) {
      return false;
    }
    return (
      fields.filter((f) => !this.isNullOrWhitespace(f) && f.toLowerCase() === name.toLowerCase())
        .length > 0
    );
  }
}
