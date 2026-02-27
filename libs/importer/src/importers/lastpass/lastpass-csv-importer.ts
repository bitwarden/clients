// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

export class LastPassCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
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
        this.parseSecureNote(value, cipher);
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

  private parseSecureNote(value: any, cipher: CipherView) {
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
              const month = new Date(Date.parse(monthString.trim() + " 1, 2012")).getMonth() + 1;
              if (isNaN(month)) {
                mappedData.expMonth = undefined;
              } else {
                mappedData.expMonth = month.toString();
              }
            } else {
              mappedData.expMonth = undefined;
            }
            if (!this.isNullOrWhitespace(year)) {
              mappedData.expYear = year;
            }
          }

          cipher.type = CipherType.Card;
          cipher.card = mappedData;
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
          cipher.identity = mappedData;
        }
        processedNote = true;
      }
    }

    if (!processedNote) {
      cipher.secureNote = new SecureNoteView();
      cipher.secureNote.type = SecureNoteType.Generic;
      cipher.notes = this.getValueOrDefault(value.extra);
    }
  }

  private parseSecureNoteMapping<T>(cipher: CipherView, extraParts: string[], map: any): T {
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
