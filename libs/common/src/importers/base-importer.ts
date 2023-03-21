import * as papa from "papaparse";

import { LogService } from "../abstractions/log.service";
import { FieldType } from "../enums/fieldType";
import { SecureNoteType } from "../enums/secureNoteType";
import { Utils } from "../misc/utils";
import { ImportResult } from "../models/domain/import-result";
import { CollectionView } from "../models/view/collection.view";
import { ConsoleLogService } from "../services/consoleLog.service";
import { Guid } from "../types/guid";
import { CipherType } from "../vault/enums/cipher-type";
import { CipherView } from "../vault/models/view/cipher.view";
import { FieldView } from "../vault/models/view/field.view";
import { FolderView } from "../vault/models/view/folder.view";
import { LoginUriView } from "../vault/models/view/login-uri.view";
import { LoginView } from "../vault/models/view/login.view";
import { SecureNoteView } from "../vault/models/view/secure-note.view";

export abstract class BaseImporter {
  organizationId: Guid = null;

  protected logService: LogService = new ConsoleLogService(false);

  protected newLineRegex = /(?:\r\n|\r|\n)/;

  protected passwordFieldNames = [
    "password",
    "pass word",
    "passphrase",
    "pass phrase",
    "pass",
    "code",
    "code word",
    "codeword",
    "secret",
    "secret word",
    "personpwd",
    "key",
    "keyword",
    "key word",
    "keyphrase",
    "key phrase",
    "form_pw",
    "wppassword",
    "pin",
    "pwd",
    "pw",
    "pword",
    "passwd",
    "p",
    "serial",
    "serial#",
    "license key",
    "reg #",

    // Non-English names
    "passwort",
  ];

  protected usernameFieldNames = [
    "user",
    "name",
    "user name",
    "username",
    "login name",
    "email",
    "e-mail",
    "id",
    "userid",
    "user id",
    "login",
    "form_loginname",
    "wpname",
    "mail",
    "loginid",
    "login id",
    "log",
    "personlogin",
    "first name",
    "last name",
    "card#",
    "account #",
    "member",
    "member #",

    // Non-English names
    "nom",
    "benutzername",
  ];

  protected notesFieldNames = [
    "note",
    "notes",
    "comment",
    "comments",
    "memo",
    "description",
    "free form",
    "freeform",
    "free text",
    "freetext",
    "free",

    // Non-English names
    "kommentar",
  ];

  protected uriFieldNames: string[] = [
    "url",
    "hyper link",
    "hyperlink",
    "link",
    "host",
    "hostname",
    "host name",
    "server",
    "address",
    "hyper ref",
    "href",
    "web",
    "website",
    "web site",
    "site",
    "web-site",
    "uri",

    // Non-English names
    "ort",
    "adresse",
  ];

  protected parseCsvOptions = {
    encoding: "UTF-8",
    skipEmptyLines: false,
  };

  protected get organization() {
    return this.organizationId != null;
  }

  protected parseXml(data: string): Document {
    const parser = new DOMParser();
    const doc = parser.parseFromString(data, "application/xml");
    return doc != null && doc.querySelector("parsererror") == null ? doc : null;
  }

  protected parseCsv(data: string, header: boolean, options: any = {}): any[] {
    const parseOptions: papa.ParseConfig<string> = Object.assign(
      { header: header },
      this.parseCsvOptions,
      options
    );
    data = this.splitNewLine(data).join("\n").trim();
    const result = papa.parse(data, parseOptions);
    if (result.errors != null && result.errors.length > 0) {
      result.errors.forEach((e) => {
        if (e.row != null) {
          this.logService.warning("Error parsing row " + e.row + ": " + e.message);
        }
      });
    }
    return result.data && result.data.length > 0 ? result.data : null;
  }

  protected parseSingleRowCsv(rowData: string) {
    if (this.isNullOrWhitespace(rowData)) {
      return null;
    }
    const parsedRow = this.parseCsv(rowData, false);
    if (parsedRow != null && parsedRow.length > 0 && parsedRow[0].length > 0) {
      return parsedRow[0];
    }
    return null;
  }

  protected makeUriArray(uri: string | string[]): LoginUriView[] {
    if (uri == null) {
      return null;
    }

    if (typeof uri === "string") {
      const loginUri = new LoginUriView();
      loginUri.uri = this.fixUri(uri);
      if (this.isNullOrWhitespace(loginUri.uri)) {
        return null;
      }
      loginUri.match = null;
      return [loginUri];
    }

    if (uri.length > 0) {
      const returnArr: LoginUriView[] = [];
      uri.forEach((u) => {
        const loginUri = new LoginUriView();
        loginUri.uri = this.fixUri(u);
        if (this.isNullOrWhitespace(loginUri.uri)) {
          return;
        }
        loginUri.match = null;
        returnArr.push(loginUri);
      });
      return returnArr.length === 0 ? null : returnArr;
    }

    return null;
  }

  protected fixUri(uri: string) {
    if (uri == null) {
      return null;
    }
    uri = uri.trim();
    if (uri.indexOf("://") === -1 && uri.indexOf(".") >= 0) {
      uri = "http://" + uri;
    }
    if (uri.length > 1000) {
      return uri.substring(0, 1000);
    }
    return uri;
  }

  protected nameFromUrl(url: string) {
    const hostname = Utils.getHostname(url);
    if (this.isNullOrWhitespace(hostname)) {
      return null;
    }
    return hostname.startsWith("www.") ? hostname.replace("www.", "") : hostname;
  }

  protected isNullOrWhitespace(str: string): boolean {
    return Utils.isNullOrWhitespace(str);
  }

  protected getValueOrDefault(str: string, defaultValue: string = null): string {
    if (this.isNullOrWhitespace(str)) {
      return defaultValue;
    }
    return str;
  }

  protected splitNewLine(str: string): string[] {
    return str.split(this.newLineRegex);
  }

  // ref https://stackoverflow.com/a/5911300
  protected getCardBrand(cardNum: string) {
    if (this.isNullOrWhitespace(cardNum)) {
      return null;
    }

    // Visa
    let re = new RegExp("^4");
    if (cardNum.match(re) != null) {
      return "Visa";
    }

    // Mastercard
    // Updated for Mastercard 2017 BINs expansion
    if (
      /^(5[1-5][0-9]{14}|2(22[1-9][0-9]{12}|2[3-9][0-9]{13}|[3-6][0-9]{14}|7[0-1][0-9]{13}|720[0-9]{12}))$/.test(
        cardNum
      )
    ) {
      return "Mastercard";
    }

    // AMEX
    re = new RegExp("^3[47]");
    if (cardNum.match(re) != null) {
      return "Amex";
    }

    // Discover
    re = new RegExp(
      "^(6011|622(12[6-9]|1[3-9][0-9]|[2-8][0-9]{2}|9[0-1][0-9]|92[0-5]|64[4-9])|65)"
    );
    if (cardNum.match(re) != null) {
      return "Discover";
    }

    // Diners
    re = new RegExp("^36");
    if (cardNum.match(re) != null) {
      return "Diners Club";
    }

    // Diners - Carte Blanche
    re = new RegExp("^30[0-5]");
    if (cardNum.match(re) != null) {
      return "Diners Club";
    }

    // JCB
    re = new RegExp("^35(2[89]|[3-8][0-9])");
    if (cardNum.match(re) != null) {
      return "JCB";
    }

    // Visa Electron
    re = new RegExp("^(4026|417500|4508|4844|491(3|7))");
    if (cardNum.match(re) != null) {
      return "Visa";
    }

    return null;
  }

  protected setCardExpiration(cipher: CipherView, expiration: string): boolean {
    if (!this.isNullOrWhitespace(expiration)) {
      expiration = expiration.replace(/\s/g, "");
      const parts = expiration.split("/");
      if (parts.length === 2) {
        let month: string = null;
        let year: string = null;
        if (parts[0].length === 1 || parts[0].length === 2) {
          month = parts[0];
          if (month.length === 2 && month[0] === "0") {
            month = month.substr(1, 1);
          }
        }
        if (parts[1].length === 2 || parts[1].length === 4) {
          year = month.length === 2 ? "20" + parts[1] : parts[1];
        }
        if (month != null && year != null) {
          cipher.card.expMonth = month;
          cipher.card.expYear = year;
          return true;
        }
      }
    }
    return false;
  }

  protected moveFoldersToCollections(result: ImportResult) {
    result.folderRelationships.forEach((r) => result.collectionRelationships.push(r));
    result.collections = result.folders.map((f) => {
      const collection = new CollectionView();
      collection.name = f.name;
      return collection;
    });
    result.folderRelationships = [];
    result.folders = [];
  }

  protected querySelectorDirectChild(parentEl: Element, query: string) {
    const els = this.querySelectorAllDirectChild(parentEl, query);
    return els.length === 0 ? null : els[0];
  }

  protected querySelectorAllDirectChild(parentEl: Element, query: string) {
    return Array.from(parentEl.querySelectorAll(query)).filter((el) => el.parentNode === parentEl);
  }

  protected initLoginCipher() {
    const cipher = new CipherView();
    cipher.favorite = false;
    cipher.notes = "";
    cipher.fields = [];
    cipher.login = new LoginView();
    cipher.type = CipherType.Login;
    return cipher;
  }

  protected cleanupCipher(cipher: CipherView) {
    if (cipher == null) {
      return;
    }
    if (cipher.type !== CipherType.Login) {
      cipher.login = null;
    }
    if (this.isNullOrWhitespace(cipher.name)) {
      cipher.name = "--";
    }
    if (this.isNullOrWhitespace(cipher.notes)) {
      cipher.notes = null;
    } else {
      cipher.notes = cipher.notes.trim();
    }
    if (cipher.fields != null && cipher.fields.length === 0) {
      cipher.fields = null;
    }
  }

  protected processKvp(
    cipher: CipherView,
    key: string,
    value: string,
    type: FieldType = FieldType.Text
  ) {
    if (this.isNullOrWhitespace(value)) {
      return;
    }
    if (this.isNullOrWhitespace(key)) {
      key = "";
    }
    if (value.length > 200 || value.trim().search(this.newLineRegex) > -1) {
      if (cipher.notes == null) {
        cipher.notes = "";
      }
      cipher.notes += key + ": " + this.splitNewLine(value).join("\n") + "\n";
    } else {
      if (cipher.fields == null) {
        cipher.fields = [];
      }
      const field = new FieldView();
      field.type = type;
      field.name = key;
      field.value = value;
      cipher.fields.push(field);
    }
  }

  protected processFolder(result: ImportResult, folderName: string) {
    let folderIndex = result.folders.length;
    const hasFolder = !this.isNullOrWhitespace(folderName);
    // Replace backslashes with forward slashes, ensuring we create sub-folders
    folderName = folderName.replace("\\", "/");
    let addFolder = hasFolder;

    if (hasFolder) {
      for (let i = 0; i < result.folders.length; i++) {
        if (result.folders[i].name === folderName) {
          addFolder = false;
          folderIndex = i;
          break;
        }
      }
    }

    if (addFolder) {
      const f = new FolderView();
      f.name = folderName;
      result.folders.push(f);
    }
    if (hasFolder) {
      result.folderRelationships.push([result.ciphers.length, folderIndex]);
    }
  }

  protected convertToNoteIfNeeded(cipher: CipherView) {
    if (
      cipher.type === CipherType.Login &&
      this.isNullOrWhitespace(cipher.login.username) &&
      this.isNullOrWhitespace(cipher.login.password) &&
      (cipher.login.uris == null || cipher.login.uris.length === 0)
    ) {
      cipher.type = CipherType.SecureNote;
      cipher.secureNote = new SecureNoteView();
      cipher.secureNote.type = SecureNoteType.Generic;
    }
  }

  protected processFullName(cipher: CipherView, fullName: string) {
    if (this.isNullOrWhitespace(fullName)) {
      return;
    }

    const nameParts = fullName.split(" ");
    if (nameParts.length > 0) {
      cipher.identity.firstName = this.getValueOrDefault(nameParts[0]);
    }
    if (nameParts.length === 2) {
      cipher.identity.lastName = this.getValueOrDefault(nameParts[1]);
    } else if (nameParts.length >= 3) {
      cipher.identity.middleName = this.getValueOrDefault(nameParts[1]);
      cipher.identity.lastName = nameParts.slice(2, nameParts.length).join(" ");
    }
  }
}
