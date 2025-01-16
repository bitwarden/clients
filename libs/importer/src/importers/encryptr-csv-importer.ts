// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CipherType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";

import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class EncryptrCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(value.Label, "--");
      cipher.notes = this.getValueOrDefault(value.Notes);
      const text = this.getValueOrDefault(value.Text);
      if (!this.isNullOrWhitespace(text)) {
        if (this.isNullOrWhitespace(cipher.notes)) {
          cipher.notes = text;
        } else {
          cipher.notes += "\n\n" + text;
        }
      }

      const type = value["Entry Type"];
      if (type === "Password") {
        cipher.login.username = this.getValueOrDefault(value.Username);
        cipher.login.password = this.getValueOrDefault(value.Password);
        cipher.login.uris = this.makeUriArray(value["Site URL"]);
      } else if (type === "Credit Card") {
        cipher.type = CipherType.Card;
        cipher.card = new CardView();
        cipher.card.cardholderName = this.getValueOrDefault(value["Name on card"]);
        cipher.card.number = this.getValueOrDefault(value["Card Number"]);
        cipher.card.brand = CardView.getCardBrandByPatterns(cipher.card.number);
        cipher.card.code = this.getValueOrDefault(value.CVV);
        const expiry = this.getValueOrDefault(value.Expiry);
        if (!this.isNullOrWhitespace(expiry)) {
          const expParts = expiry.split("/");
          if (expParts.length > 1) {
            cipher.card.expMonth = parseInt(expParts[0], null).toString();
            cipher.card.expYear = (2000 + parseInt(expParts[1], null)).toString();
          }
        }
      }

      this.convertToNoteIfNeeded(cipher);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
