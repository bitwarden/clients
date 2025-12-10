// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FieldType, SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { PasswordHistoryView } from "@bitwarden/common/vault/models/view/password-history.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

import {
  Category,
  Details,
  ExportData,
  FieldsEntity,
  Item,
  LoginFieldType,
  Overview,
  PasswordHistoryEntity,
  SectionsEntity,
  UrlsEntity,
  Value,
  VaultsEntity,
} from "./types/onepassword-1pux-importer-types";

export class OnePassword1PuxImporter extends BaseImporter implements Importer {
  result = new ImportResult();

  parse(data: string): Promise<ImportResult> {
    const exportData: ExportData = JSON.parse(data);

    const account = exportData.accounts[0];
    // TODO Add handling of multiple vaults
    // const personalVaults = account.vaults[0].filter((v) => v.attrs.type === VaultAttributeTypeEnum.Personal);
    account.vaults.forEach((vault: VaultsEntity) => {
      vault.items.forEach((item: Item) => {
        if (item.state === "archived") {
          return;
        }

        const cipher = this.initLoginCipher();

        const category = item.categoryUuid as Category;
        switch (category) {
          case Category.Login:
          case Category.Database:
          case Category.Password:
          case Category.WirelessRouter:
          case Category.Server:
          case Category.API_Credential:
            cipher.type = CipherType.Login;
            cipher.login = new LoginView();
            break;
          case Category.CreditCard:
          case Category.BankAccount:
            cipher.type = CipherType.Card;
            cipher.card = new CardView();
            break;
          case Category.SecureNote:
          case Category.SoftwareLicense:
          case Category.EmailAccount:
          case Category.MedicalRecord:
            // case CategoryEnum.Document:
            cipher.type = CipherType.SecureNote;
            cipher.secureNote = new SecureNoteView();
            cipher.secureNote.type = SecureNoteType.Generic;
            break;
          case Category.Identity:
          case Category.DriversLicense:
          case Category.OutdoorLicense:
          case Category.Membership:
          case Category.Passport:
          case Category.RewardsProgram:
          case Category.SocialSecurityNumber:
            cipher.type = CipherType.Identity;
            cipher.identity = new IdentityView();
            break;
          default:
            break;
        }

        cipher.favorite = item.favIndex === 1 ? true : false;

        this.processOverview(item.overview, cipher);

        this.processLoginFields(item, cipher);

        this.processDetails(category, item.details, cipher);

        this.parsePasswordHistory(item.details.passwordHistory, cipher);

        this.processSections(category, item.details.sections, cipher);

        if (!this.isNullOrWhitespace(item.details.notesPlain)) {
          cipher.notes = item.details.notesPlain.split(this.newLineRegex).join("\n") + "\n";
        }

        this.convertToNoteIfNeeded(cipher);
        this.cleanupCipher(cipher);
        this.result.ciphers.push(cipher);
      });
    });

    if (this.organization) {
      this.moveFoldersToCollections(this.result);
    }

    this.result.success = true;
    return Promise.resolve(this.result);
  }

  private processOverview(overview: Overview, cipher: CipherView) {
    if (overview == null) {
      return;
    }

    cipher.name = this.getValueOrDefault(overview.title);

    if (overview.urls != null) {
      const urls: string[] = [];
      overview.urls.forEach((url: UrlsEntity) => {
        if (!this.isNullOrWhitespace(url.url)) {
          urls.push(url.url);
        }
      });
      cipher.login.uris = this.makeUriArray(urls);
    }

    if (overview.tags != null && overview.tags.length > 0) {
      const folderName = this.capitalize(overview.tags[0]);
      this.processFolder(this.result, folderName);
    }
  }

  private capitalize(inputString: string): string {
    return inputString.trim().replace(/\w\S*/g, (w) => w.replace(/^\w/, (c) => c.toUpperCase()));
  }

  private processLoginFields(item: Item, cipher: CipherView) {
    if (item.details == null) {
      return;
    }

    if (item.details.loginFields == null || item.details.loginFields.length === 0) {
      return;
    }

    item.details.loginFields.forEach((loginField) => {
      if (loginField.designation === "username" && loginField.value !== "") {
        cipher.type = CipherType.Login;
        cipher.login.username = loginField.value;
        return;
      }

      if (loginField.designation === "password" && loginField.value !== "") {
        cipher.type = CipherType.Login;
        cipher.login.password = loginField.value;
        return;
      }

      let fieldValue = loginField.value;
      let fieldType: FieldType = FieldType.Text;
      switch (loginField.fieldType) {
        case LoginFieldType.Password:
          fieldType = FieldType.Hidden;
          break;
        case LoginFieldType.CheckBox:
          fieldValue = loginField.value !== "" ? "true" : "false";
          fieldType = FieldType.Boolean;
          break;
        default:
          break;
      }
      this.processKvp(cipher, loginField.name, fieldValue, fieldType);
    });
  }

  private processDetails(category: Category, details: Details, cipher: CipherView) {
    if (category !== Category.Password) {
      return;
    }

    if (details == null) {
      return;
    }
    cipher.login.password = details.password;
  }

  private processSections(category: Category, sections: SectionsEntity[], cipher: CipherView) {
    if (sections == null || sections.length === 0) {
      return;
    }

    sections.forEach((section: SectionsEntity) => {
      if (section.fields == null) {
        return;
      }

      this.parseSectionFields(category, section.fields, cipher, section.title);
    });
  }

  private parseSectionFields(
    category: Category,
    fields: FieldsEntity[],
    cipher: CipherView,
    sectionTitle: string,
  ) {
    fields.forEach((field: FieldsEntity) => {
      const valueKey = Object.keys(field.value)[0];
      const anyField = field as any;

      if (
        anyField.value == null ||
        anyField.value[valueKey] == null ||
        anyField.value[valueKey] === ""
      ) {
        return;
      }

      const fieldName = this.getFieldName(field.title, sectionTitle);
      const fieldValue = this.extractValue(field.value, valueKey);

      if (cipher.type === CipherType.Login) {
        if (this.fillLogin(field, fieldValue, cipher)) {
          return;
        }

        switch (category) {
          case Category.Login:
          case Category.Database:
          case Category.EmailAccount:
          case Category.WirelessRouter:
            break;

          case Category.Server:
            if (this.isNullOrWhitespace(cipher.login.uri) && field.id === "url") {
              cipher.login.uris = this.makeUriArray(fieldValue);
              return;
            }
            break;

          case Category.API_Credential:
            if (this.fillApiCredentials(field, fieldValue, cipher)) {
              return;
            }
            break;
          default:
            break;
        }
      } else if (cipher.type === CipherType.Card) {
        if (this.fillCreditCard(field, fieldValue, cipher)) {
          return;
        }

        if (category === Category.BankAccount) {
          if (this.fillBankAccount(field, fieldValue, cipher)) {
            return;
          }
        }
      } else if (cipher.type === CipherType.Identity) {
        if (this.fillIdentity(field, fieldValue, cipher, valueKey)) {
          return;
        }
        if (valueKey === "address") {
          // fieldValue is an object casted into a string, so access the plain value instead
          const { street, city, country, zip, state } = field.value.address;
          cipher.identity.address1 = this.getValueOrDefault(street);
          cipher.identity.city = this.getValueOrDefault(city);
          if (!this.isNullOrWhitespace(country)) {
            cipher.identity.country = country.toUpperCase();
          }
          cipher.identity.postalCode = this.getValueOrDefault(zip);
          cipher.identity.state = this.getValueOrDefault(state);
          return;
        }

        switch (category) {
          case Category.Identity:
            break;
          case Category.DriversLicense:
            if (this.fillDriversLicense(field, fieldValue, cipher)) {
              return;
            }
            break;
          case Category.OutdoorLicense:
            if (this.fillOutdoorLicense(field, fieldValue, cipher)) {
              return;
            }
            break;
          case Category.Membership:
            if (this.fillMembership(field, fieldValue, cipher)) {
              return;
            }
            break;
          case Category.Passport:
            if (this.fillPassport(field, fieldValue, cipher)) {
              return;
            }
            break;
          case Category.RewardsProgram:
            if (this.fillRewardsProgram(field, fieldValue, cipher)) {
              return;
            }
            break;
          case Category.SocialSecurityNumber:
            if (this.fillSSN(field, fieldValue, cipher)) {
              return;
            }
            break;
          default:
            break;
        }
      }

      if (valueKey === "email") {
        // fieldValue is an object casted into a string, so access the plain value instead
        const { email_address, provider } = field.value.email;
        this.processKvp(cipher, fieldName, email_address, FieldType.Text);
        this.processKvp(cipher, "provider", provider, FieldType.Text);
        return;
      }

      // Do not include a password field if it's already in the history
      if (
        field.title === "password" &&
        cipher.passwordHistory != null &&
        cipher.passwordHistory.some((h) => h.password === fieldValue)
      ) {
        return;
      }

      // TODO ?? If one of the fields is marked as guarded, then activate Password-Reprompt for the entire item
      if (field.guarded && cipher.reprompt === CipherRepromptType.None) {
        cipher.reprompt = CipherRepromptType.Password;
      }

      const fieldType = valueKey === "concealed" ? FieldType.Hidden : FieldType.Text;
      this.processKvp(cipher, fieldName, fieldValue, fieldType);
    });
  }

  // Use the title if available. If not use the sectionTitle if available.
  // Default to an empty string in all other cases.
  private getFieldName(title: string, sectionTitle?: string): string {
    if (!this.isNullOrWhitespace(title)) {
      return title;
    }

    if (!this.isNullOrWhitespace(sectionTitle)) {
      return sectionTitle;
    }

    return "";
  }

  private extractValue(value: Value, valueKey: string): string {
    if (valueKey === "date") {
      return new Date(value.date * 1000).toUTCString();
    }

    if (valueKey === "monthYear") {
      return value.monthYear.toString();
    }

    return (value as any)[valueKey];
  }

  private fillLogin(field: FieldsEntity, fieldValue: string, cipher: CipherView): boolean {
    const fieldName = this.getFieldName(field.title);

    if (this.isNullOrWhitespace(cipher.login.username) && fieldName === "username") {
      cipher.login.username = fieldValue;
      return true;
    }

    if (this.isNullOrWhitespace(cipher.login.password) && fieldName === "password") {
      cipher.login.password = fieldValue;
      return true;
    }

    if (
      this.isNullOrWhitespace(cipher.login.totp) &&
      field.id != null &&
      field.id.startsWith("TOTP_")
    ) {
      cipher.login.totp = fieldValue;
      return true;
    }

    return false;
  }

  private fillApiCredentials(field: FieldsEntity, fieldValue: string, cipher: CipherView): boolean {
    const fieldName = this.getFieldName(field.title);

    if (this.isNullOrWhitespace(cipher.login.password) && fieldName === "credential") {
      cipher.login.password = fieldValue;
      return true;
    }

    if (this.isNullOrWhitespace(cipher.login.uri) && fieldName === "hostname") {
      cipher.login.uris = this.makeUriArray(fieldValue);
      return true;
    }

    return false;
  }

  private fillCreditCard(field: FieldsEntity, fieldValue: string, cipher: CipherView): boolean {
    if (this.isNullOrWhitespace(cipher.card.number) && field.id === "ccnum") {
      cipher.card.number = fieldValue;
      cipher.card.brand = CardView.getCardBrandByPatterns(cipher.card.number);
      return true;
    }

    if (this.isNullOrWhitespace(cipher.card.code) && field.id === "cvv") {
      cipher.card.code = fieldValue;
      return true;
    }

    if (this.isNullOrWhitespace(cipher.card.cardholderName) && field.id === "cardholder") {
      cipher.card.cardholderName = fieldValue;
      return true;
    }

    if (this.isNullOrWhitespace(cipher.card.expiration) && field.id === "expiry") {
      const monthYear: string = fieldValue.toString().trim();
      cipher.card.expMonth = monthYear.substring(4, 6);
      if (cipher.card.expMonth[0] === "0") {
        cipher.card.expMonth = cipher.card.expMonth.substring(1, 2);
      }
      cipher.card.expYear = monthYear.substring(0, 4);
      return true;
    }

    if (field.id === "type") {
      // Skip since brand was determined from number above
      return true;
    }

    return false;
  }

  private fillBankAccount(field: FieldsEntity, fieldValue: string, cipher: CipherView): boolean {
    if (this.isNullOrWhitespace(cipher.card.cardholderName) && field.id === "owner") {
      cipher.card.cardholderName = fieldValue;
      return true;
    }

    return false;
  }

  private fillIdentity(
    field: FieldsEntity,
    fieldValue: string,
    cipher: CipherView,
    valueKey: string,
  ): boolean {
    if (this.isNullOrWhitespace(cipher.identity.firstName) && field.id === "firstname") {
      cipher.identity.firstName = fieldValue;
      return true;
    }

    if (this.isNullOrWhitespace(cipher.identity.lastName) && field.id === "lastname") {
      cipher.identity.lastName = fieldValue;
      return true;
    }

    if (this.isNullOrWhitespace(cipher.identity.middleName) && field.id === "initial") {
      cipher.identity.middleName = fieldValue;
      return true;
    }

    if (this.isNullOrWhitespace(cipher.identity.phone) && field.id === "defphone") {
      cipher.identity.phone = fieldValue;
      return true;
    }

    if (this.isNullOrWhitespace(cipher.identity.company) && field.id === "company") {
      cipher.identity.company = fieldValue;
      return true;
    }

    if (this.isNullOrWhitespace(cipher.identity.email)) {
      if (valueKey === "email") {
        const { email_address, provider } = field.value.email;
        cipher.identity.email = this.getValueOrDefault(email_address);
        this.processKvp(cipher, "provider", provider, FieldType.Text);
        return true;
      }

      if (field.id === "email") {
        cipher.identity.email = fieldValue;
        return true;
      }
    }

    if (this.isNullOrWhitespace(cipher.identity.username) && field.id === "username") {
      cipher.identity.username = fieldValue;
      return true;
    }
    return false;
  }

  private fillDriversLicense(field: FieldsEntity, fieldValue: string, cipher: CipherView): boolean {
    if (this.isNullOrWhitespace(cipher.identity.firstName) && field.id === "fullname") {
      this.processFullName(cipher, fieldValue);
      return true;
    }

    if (this.isNullOrWhitespace(cipher.identity.address1) && field.id === "address") {
      cipher.identity.address1 = fieldValue;
      return true;
    }

    // TODO ISO code
    if (this.isNullOrWhitespace(cipher.identity.country) && field.id === "country") {
      cipher.identity.country = fieldValue;
      return true;
    }

    if (this.isNullOrWhitespace(cipher.identity.state) && field.id === "state") {
      cipher.identity.state = fieldValue;
      return true;
    }

    if (this.isNullOrWhitespace(cipher.identity.licenseNumber) && field.id === "number") {
      cipher.identity.licenseNumber = fieldValue;
      return true;
    }

    return false;
  }

  private fillOutdoorLicense(field: FieldsEntity, fieldValue: string, cipher: CipherView): boolean {
    if (this.isNullOrWhitespace(cipher.identity.firstName) && field.id === "name") {
      this.processFullName(cipher, fieldValue);
      return true;
    }

    // TODO ISO code
    if (this.isNullOrWhitespace(cipher.identity.country) && field.id === "country") {
      cipher.identity.country = fieldValue;
      return true;
    }

    if (this.isNullOrWhitespace(cipher.identity.state) && field.id === "state") {
      cipher.identity.state = fieldValue;
      return true;
    }

    return false;
  }

  private fillMembership(field: FieldsEntity, fieldValue: string, cipher: CipherView): boolean {
    if (this.isNullOrWhitespace(cipher.identity.firstName) && field.id === "member_name") {
      this.processFullName(cipher, fieldValue);
      return true;
    }

    if (this.isNullOrWhitespace(cipher.identity.company) && field.id === "org_name") {
      cipher.identity.company = fieldValue;
      return true;
    }

    if (this.isNullOrWhitespace(cipher.identity.phone) && field.id === "phone") {
      cipher.identity.phone = fieldValue;
      return true;
    }

    return false;
  }

  private fillPassport(field: FieldsEntity, fieldValue: string, cipher: CipherView): boolean {
    if (this.isNullOrWhitespace(cipher.identity.firstName) && field.id === "fullname") {
      this.processFullName(cipher, fieldValue);
      return true;
    }

    // TODO Iso
    if (this.isNullOrWhitespace(cipher.identity.country) && field.id === "issuing_country") {
      cipher.identity.country = fieldValue;
      return true;
    }

    if (this.isNullOrWhitespace(cipher.identity.passportNumber) && field.id === "number") {
      cipher.identity.passportNumber = fieldValue;
      return true;
    }

    return false;
  }

  private fillRewardsProgram(field: FieldsEntity, fieldValue: string, cipher: CipherView): boolean {
    if (this.isNullOrWhitespace(cipher.identity.firstName) && field.id === "member_name") {
      this.processFullName(cipher, fieldValue);
      return true;
    }

    if (this.isNullOrWhitespace(cipher.identity.company) && field.id === "company_name") {
      cipher.identity.company = fieldValue;
      return true;
    }

    return false;
  }

  private fillSSN(field: FieldsEntity, fieldValue: string, cipher: CipherView): boolean {
    if (this.isNullOrWhitespace(cipher.identity.firstName) && field.id === "name") {
      this.processFullName(cipher, fieldValue);
      return true;
    }

    if (this.isNullOrWhitespace(cipher.identity.ssn) && field.id === "number") {
      cipher.identity.ssn = fieldValue;
      return true;
    }

    return false;
  }

  private parsePasswordHistory(historyItems: PasswordHistoryEntity[], cipher: CipherView) {
    if (historyItems == null || historyItems.length === 0) {
      return;
    }

    const maxSize = historyItems.length > 5 ? 5 : historyItems.length;
    cipher.passwordHistory = historyItems
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
}
