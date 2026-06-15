import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FieldType, SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { BankAccountView } from "@bitwarden/common/vault/models/view/bank-account.view";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DriversLicenseView } from "@bitwarden/common/vault/models/view/drivers-license.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { PassportView } from "@bitwarden/common/vault/models/view/passport.view";
import { PasswordHistoryView } from "@bitwarden/common/vault/models/view/password-history.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";
import {
  BankAccountView as SdkBankAccountView,
  PassportView as SdkPassportView,
  DriversLicenseView as SdkDriversLicenseView,
} from "@bitwarden/sdk-internal";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

export class OnePassword1PifImporter extends BaseImporter implements Importer {
  constructor(private configService: ConfigService) {
    super();
  }

  result = new ImportResult();

  async parse(data: string): Promise<ImportResult> {
    const useNewDedicatedTypes = await this.configService.getFeatureFlag(
      FeatureFlag.PM32009NewItemTypes,
    );
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
        this.processStandardItem(item, cipher, useNewDedicatedTypes);
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

  private processStandardItem(item: any, cipher: CipherView, useNewDedicatedTypes: boolean) {
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
    } else if (item.typeName === "wallet.government.Passport" && useNewDedicatedTypes) {
      this.processPassport(item, cipher);
    } else if (item.typeName === "wallet.government.DriversLicense" && useNewDedicatedTypes) {
      this.processDriversLicense(item, cipher);
    } else if (item.typeName === "wallet.financial.BankAccountUS" && useNewDedicatedTypes) {
      this.processBankAccount(item, cipher);
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

  /**
   * Fields in a 1pif file are objects with the field name in property `n` and field value in property `v`.
   * This map is from field names (the `n` property) to the corresponding property in a BankAccountView
   */
  private bankAccountFieldMap = new Map<string, keyof SdkBankAccountView>([
    ["bankName", "bankName"],
    ["owner", "nameOnAccount"],
    ["accountType", "accountType"],
    ["routingNo", "routingNumber"],
    ["accountNo", "accountNumber"],
    ["swift", "swiftCode"],
    ["iban", "iban"],
    ["telephonePin", "pin"],
    ["branchPhone", "bankContactPhone"],
  ]);

  private processBankAccount(item: any, cipher: CipherView) {
    cipher.type = CipherType.BankAccount;
    const bankAccountView = new BankAccountView();
    for (const section of item?.secureContents?.sections ?? []) {
      section.fields = (section.fields ?? []).flatMap((field: any) => {
        const fieldMapValue = this.bankAccountFieldMap.get(field.n);
        if (fieldMapValue) {
          bankAccountView[fieldMapValue] = field.v;
          // By returning this we the flatMap will effectively filter this field from the result. This
          // prevents the field from showing up again as a custom field on the login cipher.
          return [];
        }
        return field;
      });
    }
    cipher.bankAccount = bankAccountView;
  }

  /**
   * Fields in a 1pif file are objects with the field name in property `n` and field value in property `v`.
   * This map is from field names (the `n` property) to the corresponding property in a PassportView
   */
  private passportFieldMap = new Map<string, keyof SdkPassportView>([
    ["issuing_country", "issuingCountry"],
    ["number", "passportNumber"],
    ["nationality", "nationality"],
    ["issuing_authority", "issuingAuthority"],
    ["birthplace", "birthPlace"],
    ["type", "passportType"],
  ]);

  private processPassport(item: any, cipher: CipherView) {
    cipher.type = CipherType.Passport;
    const passportView = new PassportView();
    for (const section of item?.secureContents?.sections ?? []) {
      section.fields = (section.fields ?? []).flatMap((field: any) => {
        const fieldMapValue = this.passportFieldMap.get(field.n);
        if (fieldMapValue) {
          passportView[fieldMapValue] = field.v;
        } else if (field.n === "fullname") {
          const [first, middle, last] = this.getFullName(field.v);
          passportView.givenName = first;
          if (middle) {
            passportView.givenName += ` ${middle}`;
          }
          passportView.surname = last;
        } else if (field.n === "birthdate") {
          const dob = new Date(field.v * 1000);
          passportView.dateOfBirth = dob.toUTCString();
        } else if (field.n === "issue_date") {
          const dateOfIssue = new Date(field.v * 1000);
          passportView.issueDate = dateOfIssue.toUTCString();
        } else if (field.n === "expiry_date") {
          const expiryDate = new Date(field.v * 1000);
          passportView.expirationDate = expiryDate.toUTCString();
        } else {
          return field;
        }
        // By returning an empty array the flatMap will effectively filter fields from the result.
        // This prevents the field from showing up again as a custom field on the cipher.
        return [];
      });
    }
    cipher.passport = passportView;
  }

  /**
   * Fields in a 1pif file are objects with the `n` property specifying the field name and the `t` or `v` property
   * specifying the field value. This map is from field names (the `n` property) to an array containing the
   * corresponding property in a DriversLicenseView, then the key used to get the field's value (either `t` or `v`)
   */
  private driversLicenseFieldMap = new Map<string, [keyof SdkDriversLicenseView, "t" | "v"]>([
    ["number", ["licenseNumber", "v"]],
    ["class", ["licenseClass", "v"]],
    ["state", ["issuingState", "v"]],
    ["country", ["issuingCountry", "v"]],
  ]);

  private processDriversLicense(item: any, cipher: CipherView) {
    cipher.type = CipherType.DriversLicense;
    const driversLicenseView = new DriversLicenseView();
    for (const section of item?.secureContents?.sections ?? []) {
      section.fields = (section.fields ?? []).flatMap((field: any) => {
        const fieldMapValue = this.driversLicenseFieldMap.get(field.n);
        // Some fields require special parsing
        if (field.n === "fullname") {
          const [first, middle, last] = this.getFullName(field.v);
          driversLicenseView.firstName = first;
          driversLicenseView.middleName = middle;
          driversLicenseView.lastName = last;
        } else if (field.n === "birthdate") {
          const dob = new Date(field.v * 1000);
          driversLicenseView.dateOfBirth = dob.toUTCString();
        } else if (field.n === "expiry_date") {
          // This field is a single number that expresses a month and year in the format YYYYMM
          const strValue: string = field.v.toString();
          const yearPart = strValue.slice(0, 4);
          const monthPart = strValue.slice(4);
          // We set the expiration date to the last of the specified year and month by getting
          // the first of the month afterwards and subtracting a day's worth of milliseconds
          const expirationDate = new Date(
            Date.UTC(Number(yearPart), Number(monthPart), 1) - 24 * 60 * 60 * 1000,
          );
          driversLicenseView.expirationDate = expirationDate.toUTCString();
          // If field requires no special parsing simply set the value
        } else if (fieldMapValue) {
          driversLicenseView[fieldMapValue[0]] = field[fieldMapValue[1]];
        } else {
          return field;
        }
        // Returning [] allows the flatMap on 269 to filter out fields that have already
        // been set to dedicated fields on the driver's license object
        return [];
      });
    }
    cipher.driversLicense = driversLicenseView;
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
