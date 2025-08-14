// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as papa from "papaparse";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";
import { normalizeExpiryYearFormat } from "@bitwarden/common/autofill/utils";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { FieldType, SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../models/import-result";

export abstract class BaseImporter {
  organizationId: OrganizationId = null;

  // FIXME: This should be replaced by injecting the log service.
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
    // Ensure there are no external entity elements in the XML to prevent against XXE attacks.
    if (!this.validateNoExternalEntities(data)) {
      return null;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(data, "application/xml");
    return doc != null && doc.querySelector("parsererror") == null ? doc : null;
  }

  protected parseCsv(data: string, header: boolean, options: any = {}): any[] {
    const parseOptions: papa.ParseConfig<string> = Object.assign(
      { header: header },
      this.parseCsvOptions,
      options,
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

  protected setCardExpiration(cipher: CipherView, expiration: string): boolean {
    if (this.isNullOrWhitespace(expiration)) {
      return false;
    }

    expiration = expiration.replace(/\s/g, "");

    const monthRegex = "0?(?<month>[1-9]|1[0-2])";
    const yearRegex = "(?<year>(?:[1-2][0-9])?[0-9]{2})";
    const expiryRegex = new RegExp(`^${monthRegex}/${yearRegex}$`);

    const expiryMatch = expiration.match(expiryRegex);

    if (!expiryMatch) {
      return false;
    }

    cipher.card.expMonth = expiryMatch.groups.month;
    const year: string = expiryMatch.groups.year;
    cipher.card.expYear = normalizeExpiryYearFormat(year);

    return true;
  }

  protected moveFoldersToCollections(result: ImportResult) {
    result.folderRelationships.forEach((r) => result.collectionRelationships.push(r));
    result.collections = result.folders.map((f) => {
      const collection = new CollectionView();
      collection.name = f.name;
      collection.id = (f.id as CollectionId) ?? undefined; // folder id may be null, which is not suitable for collections.
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
  }

  protected processKvp(
    cipher: CipherView,
    key: string,
    value: string,
    type: FieldType = FieldType.Text,
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

  protected processFolder(
    result: ImportResult,
    folderName: string,
    addRelationship: boolean = true,
  ) {
    if (this.isNullOrWhitespace(folderName)) {
      return;
    }

    let folderIndex = result.folders.length;
    // Replace backslashes with forward slashes, ensuring we create sub-folders
    folderName = folderName.replace(/\\/g, "/");
    let addFolder = true;

    for (let i = 0; i < result.folders.length; i++) {
      if (result.folders[i].name === folderName) {
        addFolder = false;
        folderIndex = i;
        break;
      }
    }

    if (addFolder) {
      const f = new FolderView();
      f.name = folderName;
      result.folders.push(f);
    }

    //Some folders can have sub-folders but no ciphers directly, we should not add to the folderRelationships array
    if (addRelationship) {
      result.folderRelationships.push([result.ciphers.length, folderIndex]);
    }

    // if the folder name is a/b/c/d, we need to create a/b/c and a/b and a
    const parts = folderName.split("/");
    for (let i = parts.length - 1; i > 0; i--) {
      const parentName = parts.slice(0, i).join("/") as string;
      if (result.folders.find((c) => c.name === parentName) == null) {
        const folder = new FolderView();
        folder.name = parentName;
        result.folders.push(folder);
      }
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

  private validateNoExternalEntities(data: string): boolean {
    const regex = new RegExp("<!ENTITY", "i");
    const hasExternalEntities = regex.test(data);
    return !hasExternalEntities;
  }
}
