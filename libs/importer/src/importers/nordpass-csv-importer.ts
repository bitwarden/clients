// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SecureNoteType, CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

type NordPassCsvParsed = {
  name: string;
  url: string;
  additional_urls: string;
  username: string;
  password: string;
  note: string;
  cardholdername: string;
  cardnumber: string;
  cvc: string;
  expirydate: string;
  zipcode: string;
  folder: string;
  full_name: string;
  phone_number: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  country: string;
  state: string;
  type: string;
  custom_fields: string;
};

type NordPassCustomField = {
  label: string;
  type: string;
  value: string;
};

export class NordPassCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results: NordPassCsvParsed[] = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((record) => {
      const recordType = this.evaluateType(record);
      if (recordType === undefined) {
        return;
      }

      this.processFolder(result, record.folder);

      const cipher = new CipherView();
      cipher.name = this.getValueOrDefault(record.name, "--");
      cipher.notes = this.getValueOrDefault(record.note);

      if (record.custom_fields) {
        const customFieldsParsed: NordPassCustomField[] = JSON.parse(record.custom_fields);
        if (customFieldsParsed && customFieldsParsed.length > 0) {
          customFieldsParsed.forEach((field) => {
            let fieldType = FieldType.Text;

            if (field.type == "hidden") {
              fieldType = FieldType.Hidden;
            }

            this.processKvp(cipher, field.label, field.value, fieldType);
          });
        }
      }

      switch (recordType) {
        case CipherType.Login:
          cipher.type = CipherType.Login;
          cipher.login = new LoginView();
          cipher.login.username = this.getValueOrDefault(record.username);
          cipher.login.password = this.getValueOrDefault(record.password);
          if (record.additional_urls) {
            const additionalUrlsParsed: string[] = JSON.parse(record.additional_urls);
            const uris = [record.url, ...additionalUrlsParsed];
            cipher.login.uris = this.makeUriArray(uris);
          } else {
            cipher.login.uris = this.makeUriArray(record.url);
          }
          break;
        case CipherType.Card:
          cipher.type = CipherType.Card;
          cipher.card.cardholderName = this.getValueOrDefault(record.cardholdername);
          cipher.card.number = this.getValueOrDefault(record.cardnumber);
          cipher.card.code = this.getValueOrDefault(record.cvc);
          cipher.card.brand = CardView.getCardBrandByPatterns(cipher.card.number);
          this.setCardExpiration(cipher, record.expirydate);
          break;

        case CipherType.Identity:
          cipher.type = CipherType.Identity;

          this.processFullName(cipher, this.getValueOrDefault(record.full_name));
          cipher.identity.address1 = this.getValueOrDefault(record.address1);
          cipher.identity.address2 = this.getValueOrDefault(record.address2);
          cipher.identity.city = this.getValueOrDefault(record.city);
          cipher.identity.state = this.getValueOrDefault(record.state);
          cipher.identity.postalCode = this.getValueOrDefault(record.zipcode);
          cipher.identity.country = this.getValueOrDefault(record.country);
          if (cipher.identity.country != null) {
            cipher.identity.country = cipher.identity.country.toUpperCase();
          }
          cipher.identity.email = this.getValueOrDefault(record.email);
          cipher.identity.phone = this.getValueOrDefault(record.phone_number);
          break;
        case CipherType.SecureNote:
          cipher.type = CipherType.SecureNote;
          cipher.secureNote.type = SecureNoteType.Generic;
          break;
        default:
          break;
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

  private evaluateType(record: NordPassCsvParsed): CipherType {
    switch (record.type) {
      case "password":
        return CipherType.Login;
      case "credit_card":
        return CipherType.Card;
      case "note":
        return CipherType.SecureNote;
      case "identity":
        return CipherType.Identity;
    }

    return undefined;
  }
}
