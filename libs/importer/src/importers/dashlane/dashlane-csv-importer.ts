// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

import {
  CredentialsRecord,
  IdRecord,
  PaymentsRecord,
  PersonalInformationRecord,
  SecureNoteRecord,
} from "./types/dashlane-csv-types";

const _mappedCredentialsColumns = new Set([
  "title",
  "note",
  "username",
  "password",
  "url",
  "otpSecret",
  "category",
]);

const _mappedPersonalInfoAsIdentityColumns = new Set([
  "type",
  "title",
  "first_name",
  "middle_name",
  "last_name",
  "login",
  "email",
  "phone_number",
  "address",
  "country",
  "state",
  "city",
  "zip",
  // Skip item_name as we already have set a combined name
  "item_name",
]);

const _mappedSecureNoteColumns = new Set(["title", "note"]);

export class DashlaneCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    if (results[0].type != null && results[0].title != null) {
      const personalRecords = results as PersonalInformationRecord[];

      // If personalRecords has only one "name" then create an Identity-Cipher
      if (personalRecords.filter((x) => x.type === "name").length === 1) {
        const cipher = this.initLoginCipher();
        cipher.type = CipherType.Identity;
        cipher.identity = new IdentityView();
        results.forEach((row) => {
          this.parsePersonalInformationRecordAsIdentity(cipher, row);
        });
        this.cleanupCipher(cipher);
        result.ciphers.push(cipher);
        result.success = true;
        return Promise.resolve(result);
      }
    }

    results.forEach((row) => {
      const cipher = this.initLoginCipher();

      const rowKeys = Object.keys(row);
      if (rowKeys[0] === "username") {
        this.processFolder(result, row.category);
        this.parseCredentialsRecord(cipher, row);
      }

      if (rowKeys[0] === "type" && rowKeys[1] === "account_name") {
        this.parsePaymentRecord(cipher, row);
      }

      if (rowKeys[0] === "type" && rowKeys[1] === "number") {
        this.parseIdRecord(cipher, row);
      }

      if (rowKeys[0] === "type" && rowKeys[1] === "title") {
        this.parsePersonalInformationRecord(cipher, row);
      }

      if (rowKeys[0] === "title" && rowKeys[1] === "note") {
        this.parseSecureNoteRecords(cipher, row);
      }

      this.convertToNoteIfNeeded(cipher);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }

  parseCredentialsRecord(cipher: CipherView, row: CredentialsRecord) {
    cipher.type = CipherType.Login;
    cipher.login = new LoginView();

    cipher.name = row.title;
    cipher.notes = row.note;
    cipher.login.username = row.username;
    cipher.login.password = row.password;
    cipher.login.totp = Object.keys(row).includes("otpUrl") ? row.otpUrl : row.otpSecret;
    cipher.login.uris = this.makeUriArray(row.url);

    this.importUnmappedFields(cipher, row, _mappedCredentialsColumns);
  }

  parsePaymentRecord(cipher: CipherView, row: PaymentsRecord) {
    cipher.type = CipherType.Card;
    cipher.card = new CardView();

    cipher.name = row.account_name;
    let mappedValues: string[] = [];
    switch (row.type) {
      case "credit_card":
        cipher.card.cardholderName = row.account_name;
        cipher.card.number = row.cc_number;
        cipher.card.brand = CardView.getCardBrandByPatterns(cipher.card.number);
        cipher.card.code = row.code;
        this.setCardExpiration(cipher, `${row.expiration_month}/${row.expiration_year}`);

        // If you add more mapped fields please extend this
        mappedValues = [
          "account_name",
          "account_holder",
          "cc_number",
          "code",
          "expiration_month",
          "expiration_year",
        ];
        break;
      case "bank":
        cipher.card.cardholderName = row.account_holder;
        cipher.card.number = row.account_number;

        // If you add more mapped fields please extend this
        mappedValues = ["account_name", "account_holder", "account_number"];
        break;
      default:
        break;
    }

    this.importUnmappedFields(cipher, row, new Set(mappedValues));
  }

  parseIdRecord(cipher: CipherView, row: IdRecord) {
    cipher.type = CipherType.Identity;
    cipher.identity = new IdentityView();

    const mappedValues: string[] = ["name", "number"];
    switch (row.type) {
      case "card":
        cipher.name = `${row.name} ${row.type}`;
        this.processFullName(cipher, row.name);
        cipher.identity.licenseNumber = row.number;
        break;
      case "passport":
        cipher.name = `${row.name} ${row.type}`;
        this.processFullName(cipher, row.name);
        cipher.identity.passportNumber = row.number;
        break;
      case "license":
        cipher.name = `${row.name} ${row.type}`;
        this.processFullName(cipher, row.name);
        cipher.identity.licenseNumber = row.number;
        cipher.identity.state = row.state;

        mappedValues.push("state");
        break;
      case "social_security":
        cipher.name = `${row.name} ${row.type}`;
        this.processFullName(cipher, row.name);
        cipher.identity.ssn = row.number;
        break;
      case "tax_number":
        cipher.name = row.type;
        cipher.identity.licenseNumber = row.number;
        break;

      default:
        break;
    }

    // If you add more mapped fields please extend this
    this.importUnmappedFields(cipher, row, new Set(mappedValues));
  }

  parsePersonalInformationRecord(cipher: CipherView, row: PersonalInformationRecord) {
    cipher.type = CipherType.SecureNote;
    cipher.secureNote.type = SecureNoteType.Generic;
    if (row.type === "name") {
      cipher.name = `${row.title} ${row.first_name} ${row.middle_name} ${row.last_name}`
        .replace("  ", " ")
        .trim();
    } else {
      cipher.name = row.item_name;
    }

    const dataRow = row as any;
    Object.keys(row).forEach((key) => {
      this.processKvp(cipher, key, dataRow[key]);
    });
  }

  parsePersonalInformationRecordAsIdentity(cipher: CipherView, row: PersonalInformationRecord) {
    switch (row.type) {
      case "name":
        this.processFullName(cipher, `${row.first_name} ${row.middle_name} ${row.last_name}`);
        cipher.identity.title = row.title;
        cipher.name = cipher.identity.fullName;

        cipher.identity.username = row.login;
        break;
      case "email":
        cipher.identity.email = row.email;
        break;
      case "number":
        cipher.identity.phone = row.phone_number;
        break;
      case "address":
        cipher.identity.address1 = row.address;
        cipher.identity.city = row.city;
        cipher.identity.postalCode = row.zip;
        cipher.identity.state = row.state;
        cipher.identity.country = row.country;
        break;
      default:
        break;
    }

    this.importUnmappedFields(cipher, row, _mappedPersonalInfoAsIdentityColumns);
  }

  parseSecureNoteRecords(cipher: CipherView, row: SecureNoteRecord) {
    cipher.type = CipherType.SecureNote;
    cipher.secureNote.type = SecureNoteType.Generic;
    cipher.name = row.title;
    cipher.notes = row.note;

    this.importUnmappedFields(cipher, row, _mappedSecureNoteColumns);
  }

  importUnmappedFields(cipher: CipherView, row: any, mappedValues: Set<string>) {
    const unmappedFields = Object.keys(row).filter((x) => !mappedValues.has(x));
    unmappedFields.forEach((key) => {
      const item = row as any;
      this.processKvp(cipher, key, item[key]);
    });
  }
}
