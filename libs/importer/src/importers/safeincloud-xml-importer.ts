// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FieldType, SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class SafeInCloudXmlImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const doc = this.parseXml(data);
    if (doc == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    const db = doc.querySelector("database");
    if (db == null) {
      result.errorMessage = "Missing `database` node.";
      result.success = false;
      return Promise.resolve(result);
    }

    const foldersMap = new Map<string, number>();

    Array.from(doc.querySelectorAll("database > label")).forEach((labelEl) => {
      const name = labelEl.getAttribute("name");
      const id = labelEl.getAttribute("id");
      if (!this.isNullOrWhitespace(name) && !this.isNullOrWhitespace(id)) {
        foldersMap.set(id, result.folders.length);
        const folder = new FolderView();
        folder.name = name;
        result.folders.push(folder);
      }
    });

    Array.from(doc.querySelectorAll("database > card")).forEach((cardEl) => {
      if (cardEl.getAttribute("template") === "true" || cardEl.getAttribute("deleted") === "true") {
        return;
      }

      const labelIdEl = this.querySelectorDirectChild(cardEl, "label_id");
      if (labelIdEl != null) {
        const labelId = labelIdEl.textContent;
        if (!this.isNullOrWhitespace(labelId) && foldersMap.has(labelId)) {
          result.folderRelationships.push([result.ciphers.length, foldersMap.get(labelId)]);
        }
      }

      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(cardEl.getAttribute("title"), "--");

      if (cardEl.getAttribute("star") === "true") {
        cipher.favorite = true;
      }

      const cardType = cardEl.getAttribute("type");
      if (cardType === "note") {
        cipher.type = CipherType.SecureNote;
        cipher.secureNote = new SecureNoteView();
        cipher.secureNote.type = SecureNoteType.Generic;
      } else {
        Array.from(this.querySelectorAllDirectChild(cardEl, "field")).forEach((fieldEl) => {
          const text = fieldEl.textContent;
          if (this.isNullOrWhitespace(text)) {
            return;
          }
          const name = fieldEl.getAttribute("name");
          const fieldType = this.getValueOrDefault(fieldEl.getAttribute("type"), "").toLowerCase();
          if (fieldType === "login") {
            cipher.login.username = text;
          } else if (fieldType === "password" || fieldType === "secret") {
            // safeInCloud allows for more than one password. we just insert them here and find the one used as password later
            this.processKvp(cipher, name, text, FieldType.Hidden);
          } else if (fieldType === "one_time_password") {
            cipher.login.totp = text;
          } else if (fieldType === "notes") {
            cipher.notes += text + "\n";
          } else if (fieldType === "weblogin" || fieldType === "website") {
            cipher.login.uris.push(...this.makeUriArray(text));
          } else {
            this.processKvp(cipher, name, text);
          }
        });
      }

      Array.from(this.querySelectorAllDirectChild(cardEl, "notes")).forEach((notesEl) => {
        cipher.notes += notesEl.textContent + "\n";
      });

      this.setPassword(cipher);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }

  // Choose a password from all passwords. Take one that has password in its name, or the first one if there is no such entry
  // if its name is password, we can safely remove it form the fields. otherwise, it would maybe be best to keep it as a hidden field
  setPassword(cipher: CipherView) {
    const candidates = cipher.fields.filter((field) => field.type === FieldType.Hidden);
    if (!candidates.length) {
      return;
    }

    let choice: FieldView;
    for (const field of candidates) {
      if (this.passwordFieldNames.includes(field.name.toLowerCase())) {
        choice = field;
        cipher.fields = cipher.fields.filter((f) => f !== choice);
        break;
      }
    }

    if (!choice) {
      choice = candidates[0];
    }

    cipher.login.password = choice.value;
  }
}
