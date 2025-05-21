// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class MSecureCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, false, { delimiter: "," });
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      if (value.length < 3) {
        return;
      }

      const folderName =
        this.getValueOrDefault(value[2], "Unassigned") !== "Unassigned" ? value[2] : null;
      this.processFolder(result, folderName);

      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(value[0].split("|")[0], "--");

      if (value[1] === "Web Logins" || value[1] === "Login") {
        cipher.login.username = this.getValueOrDefault(this.splitValueRetainingLastPart(value[5]));
        cipher.login.uris = this.makeUriArray(this.splitValueRetainingLastPart(value[4]));
        cipher.login.password = this.getValueOrDefault(this.splitValueRetainingLastPart(value[6]));
        cipher.notes = !this.isNullOrWhitespace(value[3]) ? value[3].split("\\n").join("\n") : null;
      } else if (value[1] === "Credit Card") {
        cipher.type = CipherType.Card;
        cipher.card.number = this.getValueOrDefault(this.splitValueRetainingLastPart(value[4]));

        const [month, year] = this.getValueOrDefault(
          this.splitValueRetainingLastPart(value[5]),
        ).split("/");
        cipher.card.expMonth = month.trim();
        cipher.card.expYear = year.trim();
        const securityCodeRegex = RegExp("^Security Code\\|\\d*\\|");
        const securityCodeEntry = value.find((entry: string) => securityCodeRegex.test(entry));
        cipher.card.code = this.getValueOrDefault(
          this.splitValueRetainingLastPart(securityCodeEntry),
        );

        const cardNameRegex = RegExp("^Name on Card\\|\\d*\\|");
        const nameOnCardEntry = value.find((entry: string) => entry.match(cardNameRegex));
        cipher.card.cardholderName = this.getValueOrDefault(
          this.splitValueRetainingLastPart(nameOnCardEntry),
        );

        cipher.card.brand = this.getValueOrDefault(this.splitValueRetainingLastPart(value[9]), "");

        const noteRegex = RegExp("\\|\\d*\\|");
        const rawNotes = value
          .slice(2)
          .filter((entry: string) => !this.isNullOrWhitespace(entry) && !noteRegex.test(entry));
        const noteIndexes = [8, 10, 11];
        const indexedNotes = noteIndexes
          .filter((idx) => value[idx] && noteRegex.test(value[idx]))
          .map((idx) => value[idx])
          .map((val) => {
            const key = val.split("|")[0];
            const value = this.getValueOrDefault(this.splitValueRetainingLastPart(val), "");
            return `${key}: ${value}`;
          });
        cipher.notes = [...rawNotes, ...indexedNotes].join("\n");
      } else if (value.length > 3) {
        cipher.type = CipherType.SecureNote;
        cipher.secureNote = new SecureNoteView();
        cipher.secureNote.type = SecureNoteType.Generic;
        for (let i = 3; i < value.length; i++) {
          if (!this.isNullOrWhitespace(value[i])) {
            cipher.notes += value[i] + "\n";
          }
        }
      }

      if (
        !this.isNullOrWhitespace(value[1]) &&
        cipher.type !== CipherType.Login &&
        cipher.type !== CipherType.Card
      ) {
        cipher.name = value[1] + ": " + cipher.name;
      }

      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }

  // mSecure returns values separated by "|" where after the second separator is the value
  // like "Password|8|myPassword", we want to keep the "myPassword" but also ensure that if
  // the value contains any "|" it works fine
  private splitValueRetainingLastPart(value: string) {
    return value && value.split("|").slice(0, 2).concat(value.split("|").slice(2).join("|")).pop();
  }
}
