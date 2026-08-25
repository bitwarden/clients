// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FieldType, SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { BankAccountView } from "@bitwarden/common/vault/models/view/bank-account.view";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DriversLicenseView } from "@bitwarden/common/vault/models/view/drivers-license.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { PassportView } from "@bitwarden/common/vault/models/view/passport.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";
import { SshKeyView } from "@bitwarden/common/vault/models/view/ssh-key.view";
import {
  BankAccountView as SdkBankAccountView,
  PassportView as SdkPassportView,
  DriversLicenseView as SdkDriversLicenseView,
} from "@bitwarden/sdk-internal";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

import { processNames } from "./protonpass-import-utils";
import {
  ProtonPassCreditCardItemContent,
  ProtonPassCustomItemContent,
  ProtonPassIdentityItemContent,
  ProtonPassIdentityItemExtraSection,
  ProtonPassItem,
  ProtonPassItemExtraField,
  ProtonPassItemState,
  ProtonPassJsonFile,
  ProtonPassLoginItemContent,
  ProtonPassSshKeyItemContent,
} from "./types/protonpass-json-type";

export class ProtonPassJsonImporter extends BaseImporter implements Importer {
  private mappedIdentityItemKeys = [
    "fullName",
    "firstName",
    "middleName",
    "lastName",
    "email",
    "phoneNumber",
    "company",
    "socialSecurityNumber",
    "passportNumber",
    "licenseNumber",
    "organization",
    "streetAddress",
    "floor",
    "county",
    "city",
    "stateOrProvince",
    "zipOrPostalCode",
    "countryOrRegion",
  ];

  private identityItemExtraFieldsKeys = [
    "extraPersonalDetails",
    "extraAddressDetails",
    "extraContactDetails",
    "extraWorkDetails",
    "extraSections",
  ];

  constructor(
    private i18nService: I18nService,
    private configService: ConfigService,
  ) {
    super();
  }

  private processExtraFields(cipher: CipherView, extraFields: ProtonPassItemExtraField[] = []) {
    for (const extraField of extraFields) {
      this.processKvp(
        cipher,
        extraField.fieldName,
        this.getExtraFieldValue(extraField),
        this.getExtraFieldType(extraField),
      );
    }
  }

  private processIdentityItemUnmappedAndExtraFields(
    cipher: CipherView,
    identityItem: ProtonPassIdentityItemContent,
  ) {
    Object.keys(identityItem).forEach((key) => {
      if (
        !this.mappedIdentityItemKeys.includes(key) &&
        !this.identityItemExtraFieldsKeys.includes(key)
      ) {
        this.processKvp(
          cipher,
          key,
          identityItem[key as keyof ProtonPassIdentityItemContent] as string,
        );
        return;
      }

      if (this.identityItemExtraFieldsKeys.includes(key)) {
        if (key !== "extraSections") {
          const extraFields = identityItem[
            key as keyof ProtonPassIdentityItemContent
          ] as ProtonPassItemExtraField[];

          this.processExtraFields(cipher, extraFields);
        } else {
          const extraSections = identityItem[
            key as keyof ProtonPassIdentityItemContent
          ] as ProtonPassIdentityItemExtraSection[];

          extraSections?.forEach((extraSection) => {
            this.processExtraFields(cipher, extraSection.sectionFields);
          });
        }
      }
    });
  }

  private processSections(cipher: CipherView, sections: ProtonPassIdentityItemExtraSection[]) {
    sections?.forEach((section) => {
      section.sectionFields?.forEach((field) => {
        this.processKvp(
          cipher,
          field.fieldName,
          this.getExtraFieldValue(field),
          field.type === "hidden" ? FieldType.Hidden : FieldType.Text,
        );
      });
    });
  }

  async parse(data: string): Promise<ImportResult> {
    const useNewDedicatedTypes = await this.configService.getFeatureFlag(
      FeatureFlag.PM32009NewItemTypes,
    );
    const result = new ImportResult();
    const results: ProtonPassJsonFile = JSON.parse(data);
    if (results == null || results.vaults == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    if (results.encrypted) {
      result.success = false;
      result.errorMessage = this.i18nService.t("unsupportedEncryptedImport");
      return Promise.resolve(result);
    }

    for (const [, vault] of Object.entries(results.vaults)) {
      for (const item of vault.items) {
        if (item.state == ProtonPassItemState.TRASHED) {
          continue;
        }

        const cipher = this.initLoginCipher();
        cipher.name = this.getValueOrDefault(item.data.metadata.name, "--");
        cipher.notes = this.getValueOrDefault(item.data.metadata.note);
        cipher.favorite = item.pinned;

        switch (item.data.type) {
          case "login": {
            const loginContent = item.data.content as ProtonPassLoginItemContent;
            cipher.login.uris = this.makeUriArray(loginContent.urls);

            cipher.login.username = this.getValueOrDefault(loginContent.itemUsername);
            // if the cipher has no username then the email is used as the username
            if (cipher.login.username == null) {
              cipher.login.username = this.getValueOrDefault(loginContent.itemEmail);
            } else {
              this.processKvp(cipher, "email", loginContent.itemEmail);
            }

            cipher.login.password = this.getValueOrDefault(loginContent.password);
            cipher.login.totp = this.getValueOrDefault(loginContent.totpUri);
            this.processExtraFields(cipher, item.data.extraFields);
            break;
          }
          case "note":
            cipher.type = CipherType.SecureNote;
            cipher.secureNote = new SecureNoteView();
            cipher.secureNote.type = SecureNoteType.Generic;
            this.processExtraFields(cipher, item.data.extraFields);
            break;
          case "creditCard": {
            const creditCardContent = item.data.content as ProtonPassCreditCardItemContent;
            cipher.type = CipherType.Card;
            cipher.card = new CardView();
            cipher.card.cardholderName = this.getValueOrDefault(creditCardContent.cardholderName);
            cipher.card.number = this.getValueOrDefault(creditCardContent.number);
            cipher.card.brand = CardView.getCardBrandByPatterns(creditCardContent.number);
            cipher.card.code = this.getValueOrDefault(creditCardContent.verificationNumber);

            if (!this.isNullOrWhitespace(creditCardContent.expirationDate)) {
              cipher.card.expMonth = creditCardContent.expirationDate.substring(5, 7);
              cipher.card.expMonth = cipher.card.expMonth.replace(/^0+/, "");
              cipher.card.expYear = creditCardContent.expirationDate.substring(0, 4);
            }

            if (!this.isNullOrWhitespace(creditCardContent.pin)) {
              this.processKvp(cipher, "PIN", creditCardContent.pin, FieldType.Hidden);
            }

            this.processExtraFields(cipher, item.data.extraFields);
            break;
          }
          case "identity": {
            const identityContent = item.data.content as ProtonPassIdentityItemContent;
            cipher.type = CipherType.Identity;
            cipher.identity = new IdentityView();

            const { mappedFirstName, mappedMiddleName, mappedLastName } = processNames(
              this.getValueOrDefault(identityContent.fullName),
              this.getValueOrDefault(identityContent.firstName),
              this.getValueOrDefault(identityContent.middleName),
              this.getValueOrDefault(identityContent.lastName),
            );
            cipher.identity.firstName = mappedFirstName;
            cipher.identity.middleName = mappedMiddleName;
            cipher.identity.lastName = mappedLastName;

            cipher.identity.email = this.getValueOrDefault(identityContent.email);
            cipher.identity.phone = this.getValueOrDefault(identityContent.phoneNumber);
            cipher.identity.company = this.getValueOrDefault(identityContent.company);
            cipher.identity.ssn = this.getValueOrDefault(identityContent.socialSecurityNumber);
            const licenseNumber = this.getValueOrDefault(identityContent.licenseNumber);
            if (useNewDedicatedTypes) {
              if (licenseNumber) {
                const licenseCipher = this.initLoginCipher();
                licenseCipher.name = cipher.name;
                licenseCipher.type = CipherType.DriversLicense;
                licenseCipher.driversLicense = new DriversLicenseView();
                licenseCipher.driversLicense.licenseNumber = licenseNumber;
                this.processFolder(result, vault.name);
                this.cleanupCipher(licenseCipher);
                result.ciphers.push(licenseCipher);
              }
            } else {
              cipher.identity.licenseNumber = licenseNumber;
            }
            const passportNumber = this.getValueOrDefault(identityContent.passportNumber);
            if (useNewDedicatedTypes) {
              if (passportNumber) {
                const passportCipher = this.initLoginCipher();
                passportCipher.name = cipher.name;
                passportCipher.type = CipherType.Passport;
                passportCipher.passport = new PassportView();
                passportCipher.passport.passportNumber = passportNumber;
                this.processFolder(result, vault.name);
                this.cleanupCipher(passportCipher);
                result.ciphers.push(passportCipher);
              }
            } else {
              cipher.identity.passportNumber = passportNumber;
            }

            const address3 =
              `${identityContent.floor ?? ""} ${identityContent.county ?? ""}`.trim();
            cipher.identity.address1 = this.getValueOrDefault(identityContent.organization);
            cipher.identity.address2 = this.getValueOrDefault(identityContent.streetAddress);
            cipher.identity.address3 = this.getValueOrDefault(address3);

            cipher.identity.city = this.getValueOrDefault(identityContent.city);
            cipher.identity.state = this.getValueOrDefault(identityContent.stateOrProvince);
            cipher.identity.postalCode = this.getValueOrDefault(identityContent.zipOrPostalCode);
            cipher.identity.country = this.getValueOrDefault(identityContent.countryOrRegion);
            this.processIdentityItemUnmappedAndExtraFields(cipher, identityContent);
            this.processExtraFields(cipher, item.data.extraFields);
            break;
          }
          case "alias": {
            // An alias is an email-forwarding address; map it to a login with the
            // alias address as the username so the item (and its data) is preserved.
            cipher.login.username = this.getValueOrDefault(item.aliasEmail);
            this.processExtraFields(cipher, item.data.extraFields);
            break;
          }
          case "sshKey": {
            const sshKeyContent = item.data.content as ProtonPassSshKeyItemContent;
            cipher.type = CipherType.SshKey;
            cipher.sshKey = new SshKeyView();
            cipher.sshKey.privateKey = this.getValueOrDefault(sshKeyContent.privateKey, "");
            cipher.sshKey.publicKey = this.getValueOrDefault(sshKeyContent.publicKey, "");
            cipher.sshKey.keyFingerprint = this.getValueOrDefault(sshKeyContent.fingerprint, "");
            this.processExtraFields(cipher, item.data.extraFields);
            this.processSections(cipher, sshKeyContent.sections);
            break;
          }
          case "custom": {
            const customContent = item.data.content as ProtonPassCustomItemContent;
            if (
              useNewDedicatedTypes &&
              this.hasExtraFields(["Bank Name", "Account Number"], item)
            ) {
              cipher.type = CipherType.BankAccount;
              cipher.bankAccount = new BankAccountView();
              this.processBankAccountExtraFields(cipher, item.data.extraFields);
            } else if (useNewDedicatedTypes && this.hasExtraFields(["Passport Number"], item)) {
              cipher.type = CipherType.Passport;
              cipher.passport = new PassportView();
              this.processPassportExtraFields(cipher, item.data.extraFields);
            } else if (useNewDedicatedTypes && this.hasExtraFields(["License Number"], item)) {
              cipher.type = CipherType.DriversLicense;
              cipher.driversLicense = new DriversLicenseView();
              this.processDriversLicenseExtraFields(cipher, item.data.extraFields);
            } else {
              cipher.type = CipherType.SecureNote;
              cipher.secureNote = new SecureNoteView();
              cipher.secureNote.type = SecureNoteType.Generic;
              this.processExtraFields(cipher, item.data.extraFields);
              this.processSections(cipher, customContent.sections);
            }
            break;
          }
          default:
            continue;
        }

        this.processFolder(result, vault.name);
        this.cleanupCipher(cipher);
        result.ciphers.push(cipher);
      }
    }
    if (this.organization) {
      this.moveFoldersToCollections(result);
    }
    result.success = true;
    return Promise.resolve(result);
  }

  private getExtraFieldValue(field: ProtonPassItemExtraField) {
    return field.type === "totp"
      ? field.data.totpUri
      : field.type === "timestamp"
        ? field.data.timestamp
        : field.data.content;
  }

  private getExtraFieldType(field: ProtonPassItemExtraField) {
    return field.type === "totp" || field.type === "hidden" ? FieldType.Hidden : FieldType.Text;
  }

  private hasExtraFields(fieldNames: string[], item: ProtonPassItem) {
    return fieldNames.every((fn) => item.data.extraFields.some((f) => f.fieldName === fn));
  }

  private bankAccountFieldMap = new Map<string, keyof SdkBankAccountView>([
    ["Bank Name", "bankName"],
    ["Account Number", "accountNumber"],
    ["Routing Number", "routingNumber"],
    ["Account Type", "accountType"],
    ["IBAN", "iban"],
    ["SWIFT/BIC", "swiftCode"],
    ["Holder Name", "nameOnAccount"],
  ]);
  private processBankAccountExtraFields(
    cipher: CipherView,
    extraFields: ProtonPassItemExtraField[],
  ) {
    for (const field of extraFields) {
      const fieldMapValue = this.bankAccountFieldMap.get(field.fieldName);
      const fieldValue = this.getExtraFieldValue(field);
      if (fieldMapValue && !this.isNullOrWhitespace(fieldValue)) {
        if (fieldMapValue === "accountType") {
          cipher.bankAccount[fieldMapValue] = this.processBankAccountType(fieldValue);
        } else {
          cipher.bankAccount[fieldMapValue] = fieldValue;
        }
      } else {
        this.processKvp(cipher, field.fieldName, fieldValue, this.getExtraFieldType(field));
      }
    }
  }

  private driversLicenseFieldMap = new Map<string, keyof SdkDriversLicenseView>([
    ["License Number", "licenseNumber"],
    ["Issuing State/Country", "issuingState"],
    ["Expiry Date", "expirationDate"],
    ["Date of Birth", "dateOfBirth"],
    ["Class", "licenseClass"],
  ]);
  private processDriversLicenseExtraFields(
    cipher: CipherView,
    extraFields: ProtonPassItemExtraField[],
  ) {
    for (const field of extraFields) {
      const fieldMapValue = this.driversLicenseFieldMap.get(field.fieldName);
      const fieldValue = this.getExtraFieldValue(field);
      if (field.fieldName === "Full Name" && !this.isNullOrWhitespace(fieldValue)) {
        const [firstName, middleName, lastName] = this.getFullName(fieldValue);
        cipher.driversLicense.firstName = firstName;
        cipher.driversLicense.middleName = middleName;
        cipher.driversLicense.lastName = lastName;
      } else if (fieldMapValue && !this.isNullOrWhitespace(fieldValue)) {
        cipher.driversLicense[fieldMapValue] = fieldValue;
      } else {
        this.processKvp(cipher, field.fieldName, fieldValue, this.getExtraFieldType(field));
      }
    }
  }

  private passportFieldMap = new Map<string, keyof SdkPassportView>([
    ["Passport Number", "passportNumber"],
    ["Country", "issuingCountry"],
    ["Expiry Date", "expirationDate"],
    ["Date of Birth", "dateOfBirth"],
    ["Issuing Authority", "issuingAuthority"],
  ]);
  private processPassportExtraFields(cipher: CipherView, extraFields: ProtonPassItemExtraField[]) {
    for (const field of extraFields) {
      const fieldMapValue = this.passportFieldMap.get(field.fieldName);
      const fieldValue = this.getExtraFieldValue(field);
      if (field.fieldName === "Full Name" && !this.isNullOrWhitespace(fieldValue)) {
        const [firstName, middleName, lastName] = this.getFullName(fieldValue);
        cipher.passport.givenName = firstName;
        if (!this.isNullOrWhitespace(middleName)) {
          cipher.passport.givenName += ` ${middleName}`;
        }
        cipher.passport.surname = lastName;
      } else if (fieldMapValue && !this.isNullOrWhitespace(fieldValue)) {
        cipher.passport[fieldMapValue] = fieldValue;
      } else {
        this.processKvp(cipher, field.fieldName, fieldValue, this.getExtraFieldType(field));
      }
    }
  }
}
