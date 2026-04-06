// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FieldType, CipherType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

import { CipherImportContext } from "./cipher-import-context";

export const IgnoredProperties = [
  "ainfo",
  "autosubmit",
  "notesplain",
  "ps",
  "scope",
  "tags",
  "title",
  "uuid",
  "notes",
];

export abstract class OnePasswordCsvImporter extends BaseImporter implements Importer {
  protected loginPropertyParsers = [
    this.setLoginUsername,
    this.setLoginPassword,
    this.setLoginUris,
  ];
  protected creditCardPropertyParsers = [
    this.setCreditCardNumber,
    this.setCreditCardVerification,
    this.setCreditCardCardholderName,
    this.setCreditCardExpiry,
  ];
  protected identityPropertyParsers = [
    this.setIdentityFirstName,
    this.setIdentityInitial,
    this.setIdentityLastName,
    this.setIdentityUserName,
    this.setIdentityEmail,
    this.setIdentityPhone,
    this.setIdentityCompany,
  ];

  abstract setCipherType(value: any, cipher: CipherView): void;

  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true, {
      quoteChar: '"',
      escapeChar: "\\",
    });
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      if (this.isNullOrWhitespace(this.getProp(value, "title"))) {
        return;
      }

      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(this.getProp(value, "title"), "--");

      this.setNotes(value, cipher);

      this.setCipherType(value, cipher);

      let altUsername: string = null;
      for (const property in value) {
        // eslint-disable-next-line
        if (!value.hasOwnProperty(property) || this.isNullOrWhitespace(value[property])) {
          continue;
        }

        const context = new CipherImportContext(value, property, cipher);
        if (cipher.type === CipherType.Login && this.setKnownLoginValue(context)) {
          continue;
        } else if (cipher.type === CipherType.Card && this.setKnownCreditCardValue(context)) {
          continue;
        } else if (cipher.type === CipherType.Identity && this.setKnownIdentityValue(context)) {
          continue;
        }

        altUsername = this.setUnknownValue(context, altUsername);
      }

      if (
        cipher.type === CipherType.Login &&
        !this.isNullOrWhitespace(altUsername) &&
        this.isNullOrWhitespace(cipher.login.username) &&
        altUsername.indexOf("://") === -1
      ) {
        cipher.login.username = altUsername;
      }

      this.convertToNoteIfNeeded(cipher);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }

  protected getProp(obj: any, name: string): any {
    const lowerObj = Object.entries(obj).reduce((agg: any, entry: [string, any]) => {
      agg[entry[0].toLowerCase()] = entry[1];
      return agg;
    }, {});
    return lowerObj[name.toLowerCase()];
  }

  protected getPropByRegexp(obj: any, regexp: RegExp): any {
    const matchingKeys = Object.keys(obj).reduce((agg: string[], key: string) => {
      if (key.match(regexp)) {
        agg.push(key);
      }
      return agg;
    }, []);
    if (matchingKeys.length === 0) {
      return null;
    } else {
      return obj[matchingKeys[0]];
    }
  }

  protected getPropIncluding(obj: any, name: string): any {
    const includesMap = Object.keys(obj).reduce((agg: string[], entry: string) => {
      if (entry.toLowerCase().includes(name.toLowerCase())) {
        agg.push(entry);
      }
      return agg;
    }, []);
    if (includesMap.length === 0) {
      return null;
    } else {
      return obj[includesMap[0]];
    }
  }

  protected setNotes(importRecord: any, cipher: CipherView) {
    cipher.notes =
      this.getValueOrDefault(this.getProp(importRecord, "notesPlain"), "") +
      "\n" +
      this.getValueOrDefault(this.getProp(importRecord, "notes"), "") +
      "\n";
    cipher.notes.trim();
  }

  protected setKnownLoginValue(context: CipherImportContext): boolean {
    return this.loginPropertyParsers.reduce((agg: boolean, func) => {
      if (!agg) {
        agg = func.bind(this)(context);
      }
      return agg;
    }, false);
  }

  protected setKnownCreditCardValue(context: CipherImportContext): boolean {
    return this.creditCardPropertyParsers.reduce((agg: boolean, func) => {
      if (!agg) {
        agg = func.bind(this)(context);
      }
      return agg;
    }, false);
  }

  protected setKnownIdentityValue(context: CipherImportContext): boolean {
    return this.identityPropertyParsers.reduce((agg: boolean, func) => {
      if (!agg) {
        agg = func.bind(this)(context);
      }
      return agg;
    }, false);
  }

  protected setUnknownValue(context: CipherImportContext, altUsername: string): string {
    if (
      IgnoredProperties.indexOf(context.lowerProperty) === -1 &&
      !context.lowerProperty.startsWith("section:") &&
      !context.lowerProperty.startsWith("section ")
    ) {
      if (altUsername == null && context.lowerProperty === "email") {
        return context.importRecord[context.property];
      } else if (
        context.lowerProperty === "created date" ||
        context.lowerProperty === "modified date"
      ) {
        const readableDate = new Date(
          parseInt(context.importRecord[context.property], 10) * 1000,
        ).toUTCString();
        this.processKvp(context.cipher, "1Password " + context.property, readableDate);
        return null;
      }
      if (
        context.lowerProperty.includes("password") ||
        context.lowerProperty.includes("key") ||
        context.lowerProperty.includes("secret")
      ) {
        this.processKvp(
          context.cipher,
          context.property,
          context.importRecord[context.property],
          FieldType.Hidden,
        );
      } else {
        this.processKvp(context.cipher, context.property, context.importRecord[context.property]);
      }
    }
    return null;
  }

  protected setIdentityFirstName(context: CipherImportContext) {
    if (
      this.isNullOrWhitespace(context.cipher.identity.firstName) &&
      context.lowerProperty.includes("first name")
    ) {
      context.cipher.identity.firstName = context.importRecord[context.property];
      return true;
    }
    return false;
  }

  protected setIdentityInitial(context: CipherImportContext) {
    if (
      this.isNullOrWhitespace(context.cipher.identity.middleName) &&
      context.lowerProperty.includes("initial")
    ) {
      context.cipher.identity.middleName = context.importRecord[context.property];
      return true;
    }
    return false;
  }

  protected setIdentityLastName(context: CipherImportContext) {
    if (
      this.isNullOrWhitespace(context.cipher.identity.lastName) &&
      context.lowerProperty.includes("last name")
    ) {
      context.cipher.identity.lastName = context.importRecord[context.property];
      return true;
    }
    return false;
  }

  protected setIdentityUserName(context: CipherImportContext) {
    if (
      this.isNullOrWhitespace(context.cipher.identity.username) &&
      context.lowerProperty.includes("username")
    ) {
      context.cipher.identity.username = context.importRecord[context.property];
      return true;
    }
    return false;
  }

  protected setIdentityCompany(context: CipherImportContext) {
    if (
      this.isNullOrWhitespace(context.cipher.identity.company) &&
      context.lowerProperty.includes("company")
    ) {
      context.cipher.identity.company = context.importRecord[context.property];
      return true;
    }
    return false;
  }

  protected setIdentityPhone(context: CipherImportContext) {
    if (
      this.isNullOrWhitespace(context.cipher.identity.phone) &&
      context.lowerProperty.includes("default phone")
    ) {
      context.cipher.identity.phone = context.importRecord[context.property];
      return true;
    }
    return false;
  }

  protected setIdentityEmail(context: CipherImportContext) {
    if (
      this.isNullOrWhitespace(context.cipher.identity.email) &&
      context.lowerProperty.includes("email")
    ) {
      context.cipher.identity.email = context.importRecord[context.property];
      return true;
    }
    return false;
  }

  protected setCreditCardNumber(context: CipherImportContext): boolean {
    if (
      this.isNullOrWhitespace(context.cipher.card.number) &&
      context.lowerProperty.includes("number")
    ) {
      context.cipher.card.number = context.importRecord[context.property];
      context.cipher.card.brand = CardView.getCardBrandByPatterns(context.cipher.card.number);
      return true;
    }
    return false;
  }

  protected setCreditCardVerification(context: CipherImportContext) {
    if (
      this.isNullOrWhitespace(context.cipher.card.code) &&
      context.lowerProperty.includes("verification number")
    ) {
      context.cipher.card.code = context.importRecord[context.property];
      return true;
    }
    return false;
  }

  protected setCreditCardCardholderName(context: CipherImportContext) {
    if (
      this.isNullOrWhitespace(context.cipher.card.cardholderName) &&
      context.lowerProperty.includes("cardholder name")
    ) {
      context.cipher.card.cardholderName = context.importRecord[context.property];
      return true;
    }
    return false;
  }

  protected setCreditCardExpiry(context: CipherImportContext) {
    if (
      this.isNullOrWhitespace(context.cipher.card.expiration) &&
      context.lowerProperty.includes("expiry date") &&
      context.importRecord[context.property].length === 7
    ) {
      context.cipher.card.expMonth = (context.importRecord[context.property] as string).substr(
        0,
        2,
      );
      if (context.cipher.card.expMonth[0] === "0") {
        context.cipher.card.expMonth = context.cipher.card.expMonth.substr(1, 1);
      }
      context.cipher.card.expYear = (context.importRecord[context.property] as string).substr(3, 4);
      return true;
    }
    return false;
  }

  protected setLoginPassword(context: CipherImportContext) {
    if (
      this.isNullOrWhitespace(context.cipher.login.password) &&
      context.lowerProperty === "password"
    ) {
      context.cipher.login.password = context.importRecord[context.property];
      return true;
    }
    return false;
  }

  protected setLoginUsername(context: CipherImportContext) {
    if (
      this.isNullOrWhitespace(context.cipher.login.username) &&
      context.lowerProperty === "username"
    ) {
      context.cipher.login.username = context.importRecord[context.property];
      return true;
    }
    return false;
  }

  protected setLoginUris(context: CipherImportContext) {
    if (
      (context.cipher.login.uris == null || context.cipher.login.uris.length === 0) &&
      context.lowerProperty === "urls"
    ) {
      const urls = context.importRecord[context.property].split(this.newLineRegex);
      context.cipher.login.uris = this.makeUriArray(urls);
      return true;
    } else if (context.lowerProperty === "url") {
      if (context.cipher.login.uris == null) {
        context.cipher.login.uris = [];
      }
      context.cipher.login.uris.concat(this.makeUriArray(context.importRecord[context.property]));
      return true;
    }
    return false;
  }
}
