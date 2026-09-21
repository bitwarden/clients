import { SecureNoteType, CipherType, FieldType } from "@bitwarden/common/vault/enums";
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
      cipher.name = this.getValueOrDefault(value[0], "--");

      // Enpass appends a note as an unpaired trailing column, making the row length even
      const hasTrailingNote = value.length % 2 === 0;
      if (hasTrailingNote) {
        cipher.notes = this.getValueOrDefault(value[value.length - 1]);
      }

      // Field labels live at odd indices below pairsEnd; excludes the title and the trailing note
      const pairsEnd = hasTrailingNote ? value.length - 1 : value.length;
      const labels = value.filter((_: string, i: number) => i % 2 === 1 && i < pairsEnd);

      if (
        value.length === 2 ||
        (!this.containsField(labels, "username") &&
          !this.containsField(labels, "password") &&
          !this.containsField(labels, "email") &&
          !this.containsField(labels, "e-mail") &&
          !this.containsField(labels, "url") &&
          !this.containsField(labels, "website"))
      ) {
        cipher.type = CipherType.SecureNote;
        cipher.secureNote = new SecureNoteView();
        cipher.secureNote.type = SecureNoteType.Generic;
      }

      if (
        this.containsField(labels, "cardholder") &&
        this.containsField(labels, "number") &&
        this.containsField(labels, "expiry date")
      ) {
        cipher.type = CipherType.Card;
        cipher.card = new CardView();
      }

      if (pairsEnd > 2) {
        for (let i = 0; i < pairsEnd - 1; i += 2) {
          const fieldValue: string = value[i + 2];
          if (this.isNullOrWhitespace(fieldValue)) {
            continue;
          }

          const fieldName: string = value[i + 1];
          const fieldNameLower = this.normalizeFieldName(fieldName);

          if (cipher.type === CipherType.Login) {
            if (fieldNameLower === "url" || fieldNameLower === "website") {
              // Enpass exports a primary Website plus a sign-in/change-password Website;
              // both become login URIs so autofill matches either domain
              const uris = this.makeUriArray(fieldValue);
              if (uris != null) {
                cipher.login.uris = (cipher.login.uris ?? []).concat(uris);
              }
              continue;
            } else if (
              (fieldNameLower === "username" ||
                fieldNameLower === "email" ||
                fieldNameLower === "e-mail") &&
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
            } else if (
              (fieldNameLower === "totp" || fieldNameLower === "one-time code") &&
              this.isNullOrWhitespace(cipher.login.totp)
            ) {
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

          // '*' marks a sensitive Enpass field; strip it from the display name and mask the value
          const isSensitiveField = fieldName.startsWith("*");
          this.processKvp(
            cipher,
            isSensitiveField ? fieldName.slice(1).trim() : fieldName,
            fieldValue,
            isSensitiveField ? FieldType.Hidden : FieldType.Text,
          );
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
    return fields.some(
      (f) => !this.isNullOrWhitespace(f) && this.normalizeFieldName(f) === name.toLowerCase(),
    );
  }

  // Enpass prefixes sensitive field labels (e.g. Password, Security answer) with '*'
  private normalizeFieldName(name: string): string {
    return this.isNullOrWhitespace(name) ? "" : name.replace(/^\*/, "").trim().toLowerCase();
  }
}
