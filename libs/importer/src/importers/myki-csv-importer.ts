import { SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

const mappedBaseColumns = ["nickname", "additionalInfo"];
const _mappedUserAccountColumns = new Set(
  mappedBaseColumns.concat(["url", "username", "password", "twofaSecret"]),
);
const _mappedCreditCardColumns = new Set(
  mappedBaseColumns.concat(["cardNumber", "cardName", "exp_month", "exp_year", "cvv"]),
);

const _mappedIdentityColumns = new Set(
  mappedBaseColumns.concat([
    "title",
    "firstName",
    "middleName",
    "lastName",
    "email",
    "firstAddressLine",
    "secondAddressLine",
    "city",
    "country",
    "zipCode",
  ]),
);

const _mappedIdCardColumns = new Set(mappedBaseColumns.concat(["idName", "idNumber", "idCountry"]));

const _mappedTwoFaColumns = new Set(mappedBaseColumns.concat(["authToken"]));

const _mappedUserNoteColumns = new Set(mappedBaseColumns.concat(["content"]));

export class MykiCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(value.nickname, "--");
      cipher.notes = this.getValueOrDefault(value.additionalInfo);

      if (value.url !== undefined) {
        // Accounts
        cipher.login.uris = this.makeUriArray(value.url);
        cipher.login.username = this.getValueOrDefault(value.username);
        cipher.login.password = this.getValueOrDefault(value.password);
        cipher.login.totp = this.getValueOrDefault(value.twofaSecret);

        this.importUnmappedFields(cipher, value, _mappedUserAccountColumns);
      } else if (value.authToken !== undefined) {
        // TwoFA
        cipher.login.totp = this.getValueOrDefault(value.authToken);

        this.importUnmappedFields(cipher, value, _mappedTwoFaColumns);
      } else if (value.cardNumber !== undefined) {
        // Cards
        cipher.card = new CardView();
        cipher.type = CipherType.Card;
        cipher.card.cardholderName = this.getValueOrDefault(value.cardName);
        cipher.card.number = this.getValueOrDefault(value.cardNumber);
        cipher.card.brand = CardView.getCardBrandByPatterns(cipher.card.number);
        cipher.card.expMonth = this.getValueOrDefault(value.exp_month);
        cipher.card.expYear = this.getValueOrDefault(value.exp_year);
        cipher.card.code = this.getValueOrDefault(value.cvv);

        this.importUnmappedFields(cipher, value, _mappedCreditCardColumns);
      } else if (value.firstName !== undefined) {
        // Identities
        cipher.identity = new IdentityView();
        cipher.type = CipherType.Identity;
        cipher.identity.title = this.getValueOrDefault(value.title);
        cipher.identity.firstName = this.getValueOrDefault(value.firstName);
        cipher.identity.middleName = this.getValueOrDefault(value.middleName);
        cipher.identity.lastName = this.getValueOrDefault(value.lastName);
        cipher.identity.phone = this.getValueOrDefault(value.number);
        cipher.identity.email = this.getValueOrDefault(value.email);
        cipher.identity.address1 = this.getValueOrDefault(value.firstAddressLine);
        cipher.identity.address2 = this.getValueOrDefault(value.secondAddressLine);
        cipher.identity.city = this.getValueOrDefault(value.city);
        cipher.identity.country = this.getValueOrDefault(value.country);
        cipher.identity.postalCode = this.getValueOrDefault(value.zipCode);

        this.importUnmappedFields(cipher, value, _mappedIdentityColumns);
      } else if (value.idType !== undefined) {
        // IdCards

        cipher.identity = new IdentityView();
        cipher.type = CipherType.Identity;
        this.processFullName(cipher, value.idName);
        cipher.identity.country = this.getValueOrDefault(value.idCountry);

        switch (value.idType) {
          // case "Driver's License":
          // case "ID Card":
          // case "Outdoor License":
          // case "Software License":
          // case "Tax Number":
          // case "Bank Account":
          // case "Insurance Card":
          // case "Health Card":
          // case "Membership":
          // case "Database":
          // case "Reward Program":
          // case "Tour Visa":
          case "Passport":
            cipher.identity.passportNumber = value.idNumber;
            break;
          case "Social Security":
            cipher.identity.ssn = value.idNumber;
            break;
          default:
            cipher.identity.licenseNumber = value.idNumber;
            break;
        }

        this.importUnmappedFields(cipher, value, _mappedIdCardColumns);
      } else if (value.content !== undefined) {
        // Notes
        cipher.secureNote = new SecureNoteView();
        cipher.type = CipherType.SecureNote;
        cipher.secureNote.type = SecureNoteType.Generic;
        cipher.notes = this.getValueOrDefault(value.content);

        this.importUnmappedFields(cipher, value, _mappedUserNoteColumns);
      } else {
        return;
      }

      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }

  importUnmappedFields(cipher: CipherView, row: any, mappedValues: Set<string>) {
    const unmappedFields = Object.keys(row).filter((x) => !mappedValues.has(x));
    unmappedFields.forEach((key) => {
      const item = row as any;
      this.processKvp(cipher, key, item[key]);
    });
  }
}
