// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

const HandledResults = new Set([
  "ADDRESS",
  "AUTHENTIFIANT",
  "BANKSTATEMENT",
  "IDCARD",
  "IDENTITY",
  "PAYMENTMEANS_CREDITCARD",
  "PAYMENTMEAN_PAYPAL",
  "EMAIL",
]);

export class DashlaneJsonImporter extends BaseImporter implements Importer {
  private result: ImportResult;

  parse(data: string): Promise<ImportResult> {
    this.result = new ImportResult();
    const results = JSON.parse(data);
    if (results == null || results.length === 0) {
      this.result.success = false;
      return Promise.resolve(this.result);
    }

    if (results.ADDRESS != null) {
      this.processAddress(results.ADDRESS);
    }
    if (results.AUTHENTIFIANT != null) {
      this.processAuth(results.AUTHENTIFIANT);
    }
    if (results.BANKSTATEMENT != null) {
      this.processNote(results.BANKSTATEMENT, "BankAccountName");
    }
    if (results.IDCARD != null) {
      this.processNote(results.IDCARD, "Fullname");
    }
    if (results.PAYMENTMEANS_CREDITCARD != null) {
      this.processCard(results.PAYMENTMEANS_CREDITCARD);
    }
    if (results.IDENTITY != null) {
      this.processIdentity(results.IDENTITY);
    }

    for (const key in results) {
      // eslint-disable-next-line
      if (results.hasOwnProperty(key) && !HandledResults.has(key)) {
        this.processNote(results[key], null, "Generic Note");
      }
    }

    this.result.success = true;
    return Promise.resolve(this.result);
  }

  private processAuth(results: any[]) {
    results.forEach((credential: any) => {
      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(credential.title);

      cipher.login.username = this.getValueOrDefault(
        credential.login,
        this.getValueOrDefault(credential.secondaryLogin),
      );
      if (this.isNullOrWhitespace(cipher.login.username)) {
        cipher.login.username = this.getValueOrDefault(credential.email);
      } else if (!this.isNullOrWhitespace(credential.email)) {
        cipher.notes = "Email: " + credential.email + "\n";
      }

      cipher.login.password = this.getValueOrDefault(credential.password);
      cipher.login.uris = this.makeUriArray(credential.domain);
      cipher.notes += this.getValueOrDefault(credential.note, "");

      this.convertToNoteIfNeeded(cipher);
      this.cleanupCipher(cipher);
      this.result.ciphers.push(cipher);
    });
  }

  private processIdentity(results: any[]) {
    results.forEach((obj: any) => {
      const cipher = new CipherView();
      cipher.identity = new IdentityView();
      cipher.type = CipherType.Identity;
      cipher.name = this.getValueOrDefault(obj.fullName, "");
      const nameParts = cipher.name.split(" ");
      if (nameParts.length > 0) {
        cipher.identity.firstName = this.getValueOrDefault(nameParts[0]);
      }
      if (nameParts.length === 2) {
        cipher.identity.lastName = this.getValueOrDefault(nameParts[1]);
      } else if (nameParts.length === 3) {
        cipher.identity.middleName = this.getValueOrDefault(nameParts[1]);
        cipher.identity.lastName = this.getValueOrDefault(nameParts[2]);
      }
      cipher.identity.username = this.getValueOrDefault(obj.pseudo);
      this.cleanupCipher(cipher);
      this.result.ciphers.push(cipher);
    });
  }

  private processAddress(results: any[]) {
    results.forEach((obj: any) => {
      const cipher = new CipherView();
      cipher.identity = new IdentityView();
      cipher.type = CipherType.Identity;
      cipher.name = this.getValueOrDefault(obj.addressName);
      cipher.identity.address1 = this.getValueOrDefault(obj.addressFull);
      cipher.identity.city = this.getValueOrDefault(obj.city);
      cipher.identity.state = this.getValueOrDefault(obj.state);
      cipher.identity.postalCode = this.getValueOrDefault(obj.zipcode);
      cipher.identity.country = this.getValueOrDefault(obj.country);
      if (cipher.identity.country != null) {
        cipher.identity.country = cipher.identity.country.toUpperCase();
      }
      this.cleanupCipher(cipher);
      this.result.ciphers.push(cipher);
    });
  }

  private processCard(results: any[]) {
    results.forEach((obj: any) => {
      const cipher = new CipherView();
      cipher.card = new CardView();
      cipher.type = CipherType.Card;
      cipher.name = this.getValueOrDefault(obj.bank);
      cipher.card.number = this.getValueOrDefault(obj.cardNumber);
      cipher.card.brand = CardView.getCardBrandByPatterns(cipher.card.number);
      cipher.card.cardholderName = this.getValueOrDefault(obj.owner);
      if (!this.isNullOrWhitespace(cipher.card.brand)) {
        if (this.isNullOrWhitespace(cipher.name)) {
          cipher.name = cipher.card.brand;
        } else {
          cipher.name += " - " + cipher.card.brand;
        }
      }
      this.cleanupCipher(cipher);
      this.result.ciphers.push(cipher);
    });
  }

  private processNote(results: any[], nameProperty: string, name: string = null) {
    results.forEach((obj: any) => {
      const cipher = new CipherView();
      cipher.secureNote = new SecureNoteView();
      cipher.type = CipherType.SecureNote;
      cipher.secureNote.type = SecureNoteType.Generic;
      if (name != null) {
        cipher.name = name;
      } else {
        cipher.name = this.getValueOrDefault(obj[nameProperty]);
      }
      for (const key in obj) {
        // eslint-disable-next-line
        if (obj.hasOwnProperty(key) && key !== nameProperty) {
          this.processKvp(cipher, key, obj[key].toString());
        }
      }
      this.cleanupCipher(cipher);
      this.result.ciphers.push(cipher);
    });
  }
}
