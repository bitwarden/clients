// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FieldType, SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

import {
  AppPasswordEntry,
  BookmarkEntry,
  EnvironmentVariablesEntry,
  FoldersEntity,
  GPGEntry,
  NotesEntry,
  PsonoItemTypes,
  PsonoJsonExport,
  TOTPEntry,
  WebsitePasswordEntry,
} from "./psono-json-types";

export class PsonoJsonImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const psonoExport: PsonoJsonExport = JSON.parse(data);
    if (psonoExport == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    this.parseFolders(result, psonoExport.folders);
    this.handleItemParsing(result, psonoExport.items);

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }

  private parseFolders(result: ImportResult, folders: FoldersEntity[], parentName?: string) {
    if (folders == null || folders.length === 0) {
      return;
    }

    folders.forEach((folder) => {
      const folderHasItems = folder.items != null && folder.items.length > 0;
      const folderHasSubfolders = folder.folders != null && folder.folders.length > 0;

      if (!folderHasItems && !folderHasSubfolders) {
        return;
      }

      if (!Utils.isNullOrWhitespace(parentName)) {
        folder.name = parentName + "/" + folder.name;
      }

      if (folderHasSubfolders) {
        this.parseFolders(result, folder.folders, folder.name);
      }

      if (!folderHasItems) {
        this.processFolder(result, folder.name, folderHasItems);
      } else {
        this.handleItemParsing(result, folder.items, folder.name);
      }
    });
  }

  private handleItemParsing(result: ImportResult, items?: PsonoItemTypes[], folderName?: string) {
    if (items == null || items.length === 0) {
      return;
    }

    items.forEach((record) => {
      const cipher = this.parsePsonoItem(record);
      this.processFolder(result, folderName, true);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });
  }

  private parsePsonoItem(item: PsonoItemTypes): CipherView {
    const cipher = this.initLoginCipher();

    switch (item.type) {
      case "website_password":
        this.parseWebsiteLogins(item, cipher);
        break;
      case "application_password":
        this.parseApplicationPasswords(item, cipher);
        break;
      case "environment_variables":
        this.parseEnvironmentVariables(item, cipher);
        break;
      case "totp":
        this.parseTOTP(item, cipher);
        break;
      case "bookmark":
        this.parseBookmarks(item, cipher);
        break;
      // Skipping this until we can save GPG into notes/custom fields
      // case "mail_gpg_own_key":
      //   this.parseGPG(item, cipher);
      //   break;
      case "note":
        this.parseNotes(item, cipher);
        break;
      default:
        break;
    }

    return cipher;
  }

  readonly WEBSITE_mappedValues = new Set([
    "type",
    "name",
    "website_password_title",
    "website_password_notes",
    "website_password_username",
    "website_password_password",
    "website_password_url",
    "autosubmit",
    "website_password_auto_submit",
    "urlfilter",
    "website_password_url_filter",
  ]);
  private parseWebsiteLogins(entry: WebsitePasswordEntry, cipher: CipherView) {
    if (entry == null || entry.type != "website_password") {
      return;
    }

    cipher.name = entry.website_password_title;
    cipher.notes = entry.website_password_notes;

    cipher.login.username = entry.website_password_username;
    cipher.login.password = entry.website_password_password;

    cipher.login.uris = this.makeUriArray(entry.website_password_url);

    this.processKvp(
      cipher,
      "website_password_auto_submit",
      entry.website_password_auto_submit?.toString(),
      FieldType.Boolean,
    );

    this.processKvp(cipher, "website_password_url_filter", entry.website_password_url_filter);

    this.importUnmappedFields(cipher, entry, this.WEBSITE_mappedValues);
  }

  readonly APP_PWD_mappedValues = new Set([
    "type",
    "name",
    "application_password_title",
    "application_password_notes",
    "application_password_username",
    "application_password_password",
  ]);
  private parseApplicationPasswords(entry: AppPasswordEntry, cipher: CipherView) {
    if (entry == null || entry.type != "application_password") {
      return;
    }

    cipher.name = entry.application_password_title;
    cipher.notes = entry.application_password_notes;

    cipher.login.username = entry.application_password_username;
    cipher.login.password = entry.application_password_password;

    this.importUnmappedFields(cipher, entry, this.APP_PWD_mappedValues);
  }

  readonly BOOKMARK_mappedValues = new Set([
    "type",
    "name",
    "bookmark_title",
    "bookmark_notes",
    "bookmark_url",
  ]);
  private parseBookmarks(entry: BookmarkEntry, cipher: CipherView) {
    if (entry == null || entry.type != "bookmark") {
      return;
    }

    cipher.name = entry.bookmark_title;
    cipher.notes = entry.bookmark_notes;

    cipher.login.uris = this.makeUriArray(entry.bookmark_url);

    this.importUnmappedFields(cipher, entry, this.BOOKMARK_mappedValues);
  }

  readonly NOTES_mappedValues = new Set(["type", "name", "note_title", "note_notes"]);
  private parseNotes(entry: NotesEntry, cipher: CipherView) {
    if (entry == null || entry.type != "note") {
      return;
    }
    cipher.type = CipherType.SecureNote;
    cipher.secureNote = new SecureNoteView();
    cipher.secureNote.type = SecureNoteType.Generic;
    cipher.name = entry.note_title;
    cipher.notes = entry.note_notes;

    this.importUnmappedFields(cipher, entry, this.NOTES_mappedValues);
  }

  readonly TOTP_mappedValues = new Set(["type", "name", "totp_title", "totp_notes", "totp_code"]);
  private parseTOTP(entry: TOTPEntry, cipher: CipherView) {
    if (entry == null || entry.type != "totp") {
      return;
    }

    cipher.name = entry.totp_title;
    cipher.notes = entry.totp_notes;

    cipher.login.totp = entry.totp_code;

    this.importUnmappedFields(cipher, entry, this.TOTP_mappedValues);
  }

  readonly ENV_VARIABLES_mappedValues = new Set([
    "type",
    "name",
    "environment_variables_title",
    "environment_variables_notes",
    "environment_variables_variables",
  ]);
  private parseEnvironmentVariables(entry: EnvironmentVariablesEntry, cipher: CipherView) {
    if (entry == null || entry.type != "environment_variables") {
      return;
    }

    cipher.type = CipherType.SecureNote;
    cipher.secureNote = new SecureNoteView();
    cipher.secureNote.type = SecureNoteType.Generic;
    cipher.name = entry.environment_variables_title;
    cipher.notes = entry.environment_variables_notes;

    entry.environment_variables_variables.forEach((KvPair) => {
      this.processKvp(cipher, KvPair.key, KvPair.value);
    });

    this.importUnmappedFields(cipher, entry, this.ENV_VARIABLES_mappedValues);
  }

  readonly GPG_mappedValues = new Set([
    "type",
    "name",
    "mail_gpg_own_key_title",
    "mail_gpg_own_key_public",
    "mail_gpg_own_key_name",
    "mail_gpg_own_key_email",
    "mail_gpg_own_key_private",
  ]);
  private parseGPG(entry: GPGEntry, cipher: CipherView) {
    if (entry == null || entry.type != "mail_gpg_own_key") {
      return;
    }

    cipher.type = CipherType.SecureNote;
    cipher.secureNote = new SecureNoteView();
    cipher.secureNote.type = SecureNoteType.Generic;
    cipher.name = entry.mail_gpg_own_key_title;
    cipher.notes = entry.mail_gpg_own_key_public;

    this.processKvp(cipher, "mail_gpg_own_key_name", entry.mail_gpg_own_key_name);
    this.processKvp(cipher, "mail_gpg_own_key_email", entry.mail_gpg_own_key_email);
    this.processKvp(
      cipher,
      "mail_gpg_own_key_private",
      entry.mail_gpg_own_key_private,
      FieldType.Hidden,
    );

    this.importUnmappedFields(cipher, entry, this.GPG_mappedValues);
  }

  private importUnmappedFields(
    cipher: CipherView,
    entry: PsonoItemTypes,
    mappedValues: Set<string>,
  ) {
    const unmappedFields = Object.keys(entry).filter((x) => !mappedValues.has(x));
    unmappedFields.forEach((key) => {
      const item = entry as any;
      this.processKvp(cipher, key, item[key].toString());
    });
  }
}
