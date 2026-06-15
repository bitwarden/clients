// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { BankAccountView } from "@bitwarden/common/vault/models/view/bank-account.view";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DriversLicenseView } from "@bitwarden/common/vault/models/view/drivers-license.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { PassportView } from "@bitwarden/common/vault/models/view/passport.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

export class LastPassCsvImporter extends BaseImporter implements Importer {
  constructor(private configService: ConfigService) {
    super();
  }

  async parse(data: string): Promise<ImportResult> {
    const useNewDedicatedTypes = await this.configService.getFeatureFlag(
      FeatureFlag.PM32009NewItemTypes,
    );
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      const cipherIndex = result.ciphers.length;
      let folderIndex = result.folders.length;
      let grouping = value.grouping;
      if (grouping != null) {
        // eslint-disable-next-line
        grouping = grouping.replace(/\\/g, "/").replace(/[\x00-\x1F\x7F-\x9F]/g, "");
      }
      const hasFolder = this.getValueOrDefault(grouping, "(none)") !== "(none)";
      let addFolder = hasFolder;

      if (hasFolder) {
        for (let i = 0; i < result.folders.length; i++) {
          if (result.folders[i].name === grouping) {
            addFolder = false;
            folderIndex = i;
            break;
          }
        }
      }

      const cipher = this.buildBaseCipher(value);
      if (cipher.type === CipherType.Login) {
        cipher.notes = this.getValueOrDefault(value.extra);
        cipher.login = new LoginView();
        cipher.login.uris = this.makeUriArray(value.url);
        cipher.login.username = this.getValueOrDefault(value.username);
        cipher.login.password = this.getValueOrDefault(value.password);
        cipher.login.totp = this.getValueOrDefault(value.totp);
      } else if (cipher.type === CipherType.SecureNote) {
        this.parseSecureNote(value, cipher, useNewDedicatedTypes);
      } else if (cipher.type === CipherType.Card) {
        cipher.card = this.parseCard(value);
        cipher.notes = this.getValueOrDefault(value.notes);
      } else if (cipher.type === CipherType.Identity) {
        cipher.identity = this.parseIdentity(value);
        cipher.notes = this.getValueOrDefault(value.notes);
        if (!this.isNullOrWhitespace(value.ccnum)) {
          // there is a card on this identity too
          const cardCipher = this.buildBaseCipher(value);
          cardCipher.identity = null;
          cardCipher.type = CipherType.Card;
          cardCipher.card = this.parseCard(value);
          result.ciphers.push(cardCipher);
        }
      }

      result.ciphers.push(cipher);

      if (addFolder) {
        const f = new FolderView();
        f.name = grouping;
        result.folders.push(f);
      }
      if (hasFolder) {
        result.folderRelationships.push([cipherIndex, folderIndex]);
      }
    });

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }

  private buildBaseCipher(value: any) {
    const cipher = new CipherView();
    // eslint-disable-next-line
    if (value.hasOwnProperty("profilename") && value.hasOwnProperty("profilelanguage")) {
      // form fill
      cipher.favorite = false;
      cipher.name = this.getValueOrDefault(value.profilename, "--");
      cipher.type = CipherType.Card;

      if (
        !this.isNullOrWhitespace(value.title) ||
        !this.isNullOrWhitespace(value.firstname) ||
        !this.isNullOrWhitespace(value.lastname) ||
        !this.isNullOrWhitespace(value.address1) ||
        !this.isNullOrWhitespace(value.phone) ||
        !this.isNullOrWhitespace(value.username) ||
        !this.isNullOrWhitespace(value.email)
      ) {
        cipher.type = CipherType.Identity;
      }
    } else {
      // site or secure note
      cipher.favorite = !this.organization && this.getValueOrDefault(value.fav, "0") === "1";
      cipher.name = this.getValueOrDefault(value.name, "--");
      cipher.type = value.url === "http://sn" ? CipherType.SecureNote : CipherType.Login;
    }
    return cipher;
  }

  private parseCard(value: any): CardView {
    const card = new CardView();
    card.cardholderName = this.getValueOrDefault(value.ccname);
    card.number = this.getValueOrDefault(value.ccnum);
    card.code = this.getValueOrDefault(value.cccsc);
    card.brand = CardView.getCardBrandByPatterns(card.number);

    if (!this.isNullOrWhitespace(value.ccexp) && value.ccexp.indexOf("-") > -1) {
      const ccexpParts = (value.ccexp as string).split("-");
      if (ccexpParts.length > 1) {
        card.expYear = ccexpParts[0];
        card.expMonth = ccexpParts[1];
        if (card.expMonth.length === 2 && card.expMonth[0] === "0") {
          card.expMonth = card.expMonth[1];
        }
      }
    }

    return card;
  }

  private parseIdentity(value: any): IdentityView {
    const identity = new IdentityView();
    identity.title = this.getValueOrDefault(value.title);
    identity.firstName = this.getValueOrDefault(value.firstname);
    identity.middleName = this.getValueOrDefault(value.middlename);
    identity.lastName = this.getValueOrDefault(value.lastname);
    identity.username = this.getValueOrDefault(value.username);
    identity.company = this.getValueOrDefault(value.company);
    identity.ssn = this.getValueOrDefault(value.ssn);
    identity.address1 = this.getValueOrDefault(value.address1);
    identity.address2 = this.getValueOrDefault(value.address2);
    identity.address3 = this.getValueOrDefault(value.address3);
    identity.city = this.getValueOrDefault(value.city);
    identity.state = this.getValueOrDefault(value.state);
    identity.postalCode = this.getValueOrDefault(value.zip);
    identity.country = this.getValueOrDefault(value.country);
    identity.email = this.getValueOrDefault(value.email);
    identity.phone = this.getValueOrDefault(value.phone);

    if (!this.isNullOrWhitespace(identity.title)) {
      identity.title = identity.title.charAt(0).toUpperCase() + identity.title.slice(1);
    }

    return identity;
  }

  private parseSecureNote(value: any, cipher: CipherView, useNewDedicatedTypes: boolean) {
    const extraParts = this.splitNewLine(value.extra);
    let processedNote = false;

    if (extraParts.length) {
      const typeParts = extraParts[0].split(":");
      if (
        typeParts.length > 1 &&
        typeParts[0] === "NoteType" &&
        (typeParts[1] === "Credit Card" || typeParts[1] === "Address")
      ) {
        if (typeParts[1] === "Credit Card") {
          const mappedData = this.parseSecureNoteMapping<CardView>(cipher, extraParts, {
            Number: "number",
            "Name on Card": "cardholderName",
            "Security Code": "code",
            // LP provides date in a format like 'June,2020'
            // Store in expMonth, then parse and modify
            "Expiration Date": "expMonth",
          });

          if (this.isNullOrWhitespace(mappedData.expMonth) || mappedData.expMonth === ",") {
            // No expiration data
            mappedData.expMonth = undefined;
          } else {
            const [monthString, year] = mappedData.expMonth.split(",");
            // Parse month name into number
            if (!this.isNullOrWhitespace(monthString)) {
              const month = this.getMonthNumberFromName(monthString);
              mappedData.expMonth = month;
            } else {
              mappedData.expMonth = undefined;
            }
            if (!this.isNullOrWhitespace(year)) {
              mappedData.expYear = year;
            }
          }

          cipher.type = CipherType.Card;
          cipher.card = new CardView();
          Object.assign(cipher.card, mappedData);
        } else if (typeParts[1] === "Address") {
          const mappedData = this.parseSecureNoteMapping<IdentityView>(cipher, extraParts, {
            Title: "title",
            "First Name": "firstName",
            "Last Name": "lastName",
            "Middle Name": "middleName",
            Company: "company",
            "Address 1": "address1",
            "Address 2": "address2",
            "Address 3": "address3",
            "City / Town": "city",
            State: "state",
            "Zip / Postal Code": "postalCode",
            Country: "country",
            "Email Address": "email",
            Username: "username",
          });
          cipher.type = CipherType.Identity;
          cipher.identity = new IdentityView();
          Object.assign(cipher.identity, mappedData);
        }
        processedNote = true;
      }
      if (useNewDedicatedTypes && typeParts[0] === "NoteType" && typeParts[1] === "Bank Account") {
        const mappedData = this.parseSecureNoteMapping<BankAccountView>(cipher, extraParts, {
          "Bank Name": "bankName",
          "Account Type": "accountType",
          "Routing Number": "routingNumber",
          "Account Number": "accountNumber",
          "SWIFT Code": "swiftCode",
          "IBAN Number": "iban",
          Pin: "pin",
          "Branch Phone": "bankContactPhone",
        });
        cipher.type = CipherType.BankAccount;
        cipher.bankAccount = new BankAccountView();
        Object.assign(cipher.bankAccount, mappedData);
        processedNote = true;
      }

      if (useNewDedicatedTypes && typeParts[0] === "NoteType" && typeParts[1] === "Passport") {
        const mappedData = this.parseSecureNoteMapping<PassportView>(cipher, extraParts, {
          Type: "passportType",
          // Store full name in givenName field then parse later
          Name: "givenName",
          Country: "issuingCountry",
          Number: "passportNumber",
          Nationality: "nationality",
          "Issuing Authority": "issuingAuthority",
          // LP provides date in a format like 'June,20,2020'
          // Store in dateOfBirth, then parse and modify
          "Date of Birth": "dateOfBirth",
          // LP provides date in a format like 'June,20,2020'
          // Store in issueDate, then parse and modify
          "Issued Date": "issueDate",
          // LP provides date in a format like 'June,20,2020'
          // Store in expirationDate, then parse and modify
          "Expiration Date": "expirationDate",
        });

        // Parse full name from the givenName field
        if (!this.isNullOrWhitespace(mappedData.givenName)) {
          const [first, middle, last] = this.getFullName(mappedData.givenName);
          mappedData.givenName = first;
          if (middle) {
            mappedData.givenName += ` ${middle}`;
          }
          mappedData.surname = last;
        }

        // Parse date of birth
        if (!this.isNullOrWhitespace(mappedData.dateOfBirth)) {
          const dob = this.parseFullDate(mappedData.dateOfBirth);
          mappedData.dateOfBirth = dob?.toUTCString();
        }

        // Parse issue date
        if (!this.isNullOrWhitespace(mappedData.issueDate)) {
          const issueDate = this.parseFullDate(mappedData.issueDate);
          mappedData.issueDate = issueDate?.toUTCString();
        }

        // Parse expiration date
        if (!this.isNullOrWhitespace(mappedData.expirationDate)) {
          const expirationDate = this.parseFullDate(mappedData.expirationDate);
          mappedData.expirationDate = expirationDate?.toUTCString();
        }

        cipher.type = CipherType.Passport;
        cipher.passport = new PassportView();
        Object.assign(cipher.passport, mappedData);
        processedNote = true;
      }

      if (
        useNewDedicatedTypes &&
        typeParts[0] === "NoteType" &&
        typeParts[1] === "Driver's License"
      ) {
        const mappedData = this.parseSecureNoteMapping<DriversLicenseView>(cipher, extraParts, {
          Number: "licenseNumber",
          // LP provides date in a format like 'June,20,2020'
          // Store in expirationDate, then parse and modify
          "Expiration Date": "expirationDate",
          "License Class": "licenseClass",
          // Store full name in firstName field then parse later
          Name: "firstName",
          State: "issuingState",
          Country: "issuingCountry",
          // LP provides date in a format like 'June,20,2020'
          // Store in dateofBirth, then parse and modify
          "Date of Birth": "dateOfBirth",
        });

        // Parse expiration date
        if (!this.isNullOrWhitespace(mappedData.expirationDate)) {
          const expirationDate = this.parseFullDate(mappedData.expirationDate);
          mappedData.expirationDate = expirationDate?.toUTCString();
        }

        // Parse full name from the givenName field
        if (!this.isNullOrWhitespace(mappedData.firstName)) {
          const [first, middle, last] = this.getFullName(mappedData.firstName);
          mappedData.firstName = first;
          mappedData.middleName = middle;
          mappedData.lastName = last;
        }

        // Parse date of birth
        if (!this.isNullOrWhitespace(mappedData.dateOfBirth)) {
          const dob = this.parseFullDate(mappedData.dateOfBirth);
          mappedData.dateOfBirth = dob?.toUTCString();
        }

        cipher.type = CipherType.DriversLicense;
        cipher.driversLicense = new DriversLicenseView();
        Object.assign(cipher.driversLicense, mappedData);
        processedNote = true;
      }
    }

    if (!processedNote) {
      cipher.secureNote = new SecureNoteView();
      cipher.secureNote.type = SecureNoteType.Generic;
      cipher.notes = this.getValueOrDefault(value.extra);
    }
  }

  /** Takes a string of the form "<month name>,<day>,<year>" (e.g. "June,20,2020")
   * and converts it to a date. Returns undefined if any portions of the date are missing
   */
  private parseFullDate(dateString: string): Date | undefined {
    const [monthString, dayString, yearString] = dateString.split(",");
    const month = this.getMonthNumberFromName(monthString);
    if (!month || !dayString || !yearString) {
      return undefined;
    }
    return new Date(Date.UTC(Number(yearString), Number(month) - 1, Number(dayString)));
  }

  /** Takes a month name string ("January", "February", etc.) and returns the month
   * number as a string ("1", "2", etc.). Returns undefined if it cannot parse the month */
  private getMonthNumberFromName(monthNameString: string) {
    const month = new Date(Date.parse(monthNameString.trim() + " 1, 2012")).getMonth() + 1;
    if (isNaN(month)) {
      return undefined;
    } else {
      return month.toString();
    }
  }

  private parseSecureNoteMapping<T>(
    cipher: CipherView,
    extraParts: string[],
    map: { [key: string]: keyof T },
  ): T {
    const dataObj: any = {};

    let processingNotes = false;
    extraParts.forEach((extraPart) => {
      let key: string = null;
      let val: string = null;
      if (!processingNotes) {
        if (this.isNullOrWhitespace(extraPart)) {
          return;
        }
        const colonIndex = extraPart.indexOf(":");
        if (colonIndex === -1) {
          key = extraPart;
        } else {
          key = extraPart.substring(0, colonIndex);
          if (extraPart.length > colonIndex) {
            val = extraPart.substring(colonIndex + 1);
          }
        }
        if (this.isNullOrWhitespace(key) || this.isNullOrWhitespace(val) || key === "NoteType") {
          return;
        }
      }

      if (processingNotes) {
        cipher.notes += "\n" + extraPart;
      } else if (key === "Notes") {
        if (!this.isNullOrWhitespace(cipher.notes)) {
          cipher.notes += "\n" + val;
        } else {
          cipher.notes = val;
        }
        processingNotes = true;
        // eslint-disable-next-line
      } else if (map.hasOwnProperty(key)) {
        dataObj[map[key]] = val;
      } else {
        this.processKvp(cipher, key, val);
      }
    });

    return dataObj;
  }
}
