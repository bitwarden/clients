// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FieldType, SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class SafeInCloudXmlImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    // SafeInCloud's XML export can contain a leading BOM or whitespace before the
    // `<?xml ?>` declaration. DOMParser treats that as a parse error, so strip it.
    // eslint-disable-next-line no-irregular-whitespace
    const doc = this.parseXml(data.replace(/^[\s﻿]+/, ""));
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

    Array.from(doc.querySelectorAll("database > card")).forEach((cardEl) => {
      if (cardEl.getAttribute("template") === "true" || cardEl.getAttribute("deleted") === "true") {
        return;
      }

      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(cardEl.getAttribute("title"), "--");

      if (cardEl.getAttribute("star") === "true") {
        cipher.favorite = true;
      }

      const cardType = cardEl.getAttribute("type");
      const fieldEls = Array.from(this.querySelectorAllDirectChild(cardEl, "field"));

      if (cardType === "note") {
        cipher.type = CipherType.SecureNote;
        cipher.secureNote = new SecureNoteView();
        cipher.secureNote.type = SecureNoteType.Generic;
      } else if (this.isCreditCard(fieldEls)) {
        this.processCreditCard(cipher, fieldEls);
      } else {
        this.processLogin(cipher, fieldEls);
      }

      Array.from(this.querySelectorAllDirectChild(cardEl, "notes")).forEach((notesEl) => {
        cipher.notes += notesEl.textContent + "\n";
      });

      if (cipher.type === CipherType.Login) {
        this.setPassword(cipher);
      }
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

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

  private isCreditCard(fieldEls: Element[]): boolean {
    return fieldEls.some(
      (f) => f.getAttribute("autofill") === "cc-number" && !this.isNullOrWhitespace(f.textContent),
    );
  }

  private processCreditCard(cipher: CipherView, fieldEls: Element[]) {
    cipher.type = CipherType.Card;
    cipher.card = new CardView();

    fieldEls.forEach((fieldEl) => {
      const text = fieldEl.textContent;
      if (this.isNullOrWhitespace(text)) {
        return;
      }
      const name = fieldEl.getAttribute("name");
      const autofill = fieldEl.getAttribute("autofill");
      const fieldType = this.getValueOrDefault(fieldEl.getAttribute("type"), "").toLowerCase();

      if (autofill === "cc-number") {
        cipher.card.number = text;
        cipher.card.brand = CardView.getCardBrandByPatterns(text);
        return;
      }
      if (autofill === "cc-name") {
        cipher.card.cardholderName = text;
        return;
      }
      if (autofill === "cc-exp" && this.setCardExpiration(cipher, text)) {
        return;
      }
      if (autofill === "cc-csc") {
        cipher.card.code = text;
        return;
      }

      if (fieldType === "notes") {
        cipher.notes += text + "\n";
      } else {
        this.processKvp(
          cipher,
          name,
          text,
          fieldType === "pin" ? FieldType.Hidden : FieldType.Text,
        );
      }
    });
  }

  private processLogin(cipher: CipherView, fieldEls: Element[]) {
    fieldEls.forEach((fieldEl) => {
      const text = fieldEl.textContent;
      if (this.isNullOrWhitespace(text)) {
        return;
      }
      const name = fieldEl.getAttribute("name");
      const fieldType = this.getValueOrDefault(fieldEl.getAttribute("type"), "").toLowerCase();

      if (fieldType === "login") {
        if (this.isNullOrWhitespace(cipher.login.username)) {
          cipher.login.username = text;
        } else {
          this.processKvp(cipher, name, text);
        }
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
}
