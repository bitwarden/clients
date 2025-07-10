import { FieldType, SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { PasswordHistoryView } from "@bitwarden/common/vault/models/view/password-history.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

export class OnePassword1PifImporter extends BaseImporter implements Importer {
  result = new ImportResult();

  parse(data: string): Promise<ImportResult> {
    data.split(this.newLineRegex).forEach((line) => {
      if (this.isNullOrWhitespace(line) || line[0] !== "{") {
        return;
      }
      const item = JSON.parse(line);
      if (item.trashed === true) {
        return;
      }
      const cipher = this.initLoginCipher();

      if (this.isNullOrWhitespace(item.hmac)) {
        this.processStandardItem(item, cipher);
      } else {
        this.processWinOpVaultItem(item, cipher);
      }

      this.convertToNoteIfNeeded(cipher);
      this.cleanupCipher(cipher);
      this.result.ciphers.push(cipher);
    });

    this.result.success = true;
    return Promise.resolve(this.result);
  }

  private processWinOpVaultItem(item: any, cipher: CipherView) {
    if (item.overview != null) {
      cipher.name = this.getValueOrDefault(item.overview.title);
      if (item.overview.URLs != null) {
        const urls: string[] = [];
        item.overview.URLs.forEach((url: any) => {
          if (!this.isNullOrWhitespace(url.u)) {
            urls.push(url.u);
          }
        });
        cipher.login.uris = this.makeUriArray(urls);
      }
    }

    if (item.details != null) {
      if (item.details.passwordHistory != null) {
        this.parsePasswordHistory(item.details.passwordHistory, cipher);
      }
      if (
        !this.isNullOrWhitespace(item.details.ccnum) ||
        !this.isNullOrWhitespace(item.details.cvv)
      ) {
        cipher.type = CipherType.Card;
        cipher.card = new CardView();
      } else if (
        !this.isNullOrWhitespace(item.details.firstname) ||
        !this.isNullOrWhitespace(item.details.address1)
      ) {
        cipher.type = CipherType.Identity;
        cipher.identity = new IdentityView();
      }
      if (cipher.type === CipherType.Login && !this.isNullOrWhitespace(item.details.password)) {
        cipher.login.password = item.details.password;
      }
      if (!this.isNullOrWhitespace(item.details.notesPlain)) {
        cipher.notes = item.details.notesPlain.split(this.newLineRegex).join("\n") + "\n";
      }
      if (item.details.fields != null) {
        this.parseFields(item.details.fields, cipher, "designation", "value", "name");
      }
      if (item.details.sections != null) {
        item.details.sections.forEach((section: any) => {
          if (section.fields != null) {
            this.parseFields(section.fields, cipher, "n", "v", "t");
          }
        });
      }
    }
  }

  private processStandardItem(item: any, cipher: CipherView) {
    cipher.favorite = item.openContents && item.openContents.faveIndex ? true : false;
    cipher.name = this.getValueOrDefault(item.title);

    if (item.typeName === "securenotes.SecureNote") {
      cipher.type = CipherType.SecureNote;
      cipher.secureNote = new SecureNoteView();
      cipher.secureNote.type = SecureNoteType.Generic;
    } else if (item.typeName === "wallet.financial.CreditCard") {
      cipher.type = CipherType.Card;
      cipher.card = new CardView();
    } else if (item.typeName === "identities.Identity") {
      cipher.type = CipherType.Identity;
      cipher.identity = new IdentityView();
    } else {
      cipher.login.uris = this.makeUriArray(item.location);
    }

    if (item.secureContents != null) {
      if (item.secureContents.passwordHistory != null) {
        this.parsePasswordHistory(item.secureContents.passwordHistory, cipher);
      }
      if (!this.isNullOrWhitespace(item.secureContents.notesPlain)) {
        cipher.notes = item.secureContents.notesPlain.split(this.newLineRegex).join("\n") + "\n";
      }
      if (cipher.type === CipherType.Login) {
        if (!this.isNullOrWhitespace(item.secureContents.password)) {
          cipher.login.password = item.secureContents.password;
        }
        if (item.secureContents.URLs != null) {
          const urls: string[] = [];
          item.secureContents.URLs.forEach((u: any) => {
            if (!this.isNullOrWhitespace(u.url)) {
              urls.push(u.url);
            }
          });
          if (urls.length > 0) {
            cipher.login.uris = this.makeUriArray(urls);
          }
        }
      }
      if (item.secureContents.fields != null) {
        this.parseFields(item.secureContents.fields, cipher, "designation", "value", "name");
      }
      if (item.secureContents.sections != null) {
        item.secureContents.sections.forEach((section: any) => {
          if (section.fields != null) {
            this.parseFields(section.fields, cipher, "n", "v", "t");
          }
        });
      }
    }
  }

  private parsePasswordHistory(items: any[], cipher: CipherView) {
    const maxSize = items.length > 5 ? 5 : items.length;
    cipher.passwordHistory = items
      .filter((h: any) => !this.isNullOrWhitespace(h.value) && h.time != null)
      .sort((a, b) => b.time - a.time)
      .slice(0, maxSize)
      .map((h: any) => {
        const ph = new PasswordHistoryView();
        ph.password = h.value;
        ph.lastUsedDate = new Date(("" + h.time).length >= 13 ? h.time : h.time * 1000);
        return ph;
      });
  }

  private parseFields(
    fields: any[],
    cipher: CipherView,
    designationKey: string,
    valueKey: string,
    nameKey: string,
  ) {
    fields.forEach((field: any) => {
      if (field[valueKey] == null || field[valueKey].toString().trim() === "") {
        return;
      }

      // TODO: when date FieldType exists, store this as a date field type instead of formatted Text if k is 'date'
      const fieldValue =
        field.k === "date"
          ? new Date(field[valueKey] * 1000).toUTCString()
          : field[valueKey].toString();
      const fieldDesignation =
        field[designationKey] != null ? field[designationKey].toString() : null;

      if (cipher.type === CipherType.Login) {
        if (this.isNullOrWhitespace(cipher.login.username) && fieldDesignation === "username") {
          cipher.login.username = fieldValue;
          return;
        } else if (
          this.isNullOrWhitespace(cipher.login.password) &&
          fieldDesignation === "password"
        ) {
          cipher.login.password = fieldValue;
          return;
        } else if (
          this.isNullOrWhitespace(cipher.login.totp) &&
          fieldDesignation != null &&
          fieldDesignation.startsWith("TOTP_")
        ) {
          cipher.login.totp = fieldValue;
          return;
        }
      } else if (cipher.type === CipherType.Card) {
        if (this.isNullOrWhitespace(cipher.card.number) && fieldDesignation === "ccnum") {
          cipher.card.number = fieldValue;
          cipher.card.brand = CardView.getCardBrandByPatterns(cipher.card.number);
          return;
        } else if (this.isNullOrWhitespace(cipher.card.code) && fieldDesignation === "cvv") {
          cipher.card.code = fieldValue;
          return;
        } else if (
          this.isNullOrWhitespace(cipher.card.cardholderName) &&
          fieldDesignation === "cardholder"
        ) {
          cipher.card.cardholderName = fieldValue;
          return;
        } else if (
          this.isNullOrWhitespace(cipher.card.expiration) &&
          fieldDesignation === "expiry" &&
          fieldValue.length === 6
        ) {
          cipher.card.expMonth = (fieldValue as string).substr(4, 2);
          if (cipher.card.expMonth[0] === "0") {
            cipher.card.expMonth = cipher.card.expMonth.substr(1, 1);
          }
          cipher.card.expYear = (fieldValue as string).substr(0, 4);
          return;
        } else if (fieldDesignation === "type") {
          // Skip since brand was determined from number above
          return;
        }
      } else if (cipher.type === CipherType.Identity) {
        const identity = cipher.identity;
        if (this.isNullOrWhitespace(identity.firstName) && fieldDesignation === "firstname") {
          identity.firstName = fieldValue;
          return;
        } else if (this.isNullOrWhitespace(identity.lastName) && fieldDesignation === "lastname") {
          identity.lastName = fieldValue;
          return;
        } else if (this.isNullOrWhitespace(identity.middleName) && fieldDesignation === "initial") {
          identity.middleName = fieldValue;
          return;
        } else if (this.isNullOrWhitespace(identity.phone) && fieldDesignation === "defphone") {
          identity.phone = fieldValue;
          return;
        } else if (this.isNullOrWhitespace(identity.company) && fieldDesignation === "company") {
          identity.company = fieldValue;
          return;
        } else if (this.isNullOrWhitespace(identity.email) && fieldDesignation === "email") {
          identity.email = fieldValue;
          return;
        } else if (this.isNullOrWhitespace(identity.username) && fieldDesignation === "username") {
          identity.username = fieldValue;
          return;
        } else if (fieldDesignation === "address") {
          // fieldValue is an object casted into a string, so access the plain value instead
          const { street, city, country, zip } = field[valueKey];
          identity.address1 = this.getValueOrDefault(street);
          identity.city = this.getValueOrDefault(city);
          if (!this.isNullOrWhitespace(country)) {
            identity.country = country.toUpperCase();
          }
          identity.postalCode = this.getValueOrDefault(zip);
          return;
        }
      }

      const fieldName = this.isNullOrWhitespace(field[nameKey]) ? "no_name" : field[nameKey];
      if (
        fieldName === "password" &&
        cipher.passwordHistory != null &&
        cipher.passwordHistory.some((h) => h.password === fieldValue)
      ) {
        return;
      }

      const fieldType = field.k === "concealed" ? FieldType.Hidden : FieldType.Text;
      this.processKvp(cipher, fieldName, fieldValue, fieldType);
    });
  }
}
