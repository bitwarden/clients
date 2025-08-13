// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FieldType, SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

export class BitwardenCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      if (this.organization && !this.isNullOrWhitespace(value.collections)) {
        const collections = (value.collections as string).split(",");
        collections.forEach((col) => {
          // here processFolder is used to create collections
          // In an Organization folders are converted to collections
          // see line just before this function terminates
          // where all folders are turned to collections
          this.processFolder(result, col);
        });
      } else if (!this.organization) {
        this.processFolder(result, value.folder);
      }

      const cipher = new CipherView();
      cipher.favorite =
        !this.organization && this.getValueOrDefault(value.favorite, "0") !== "0" ? true : false;
      cipher.type = CipherType.Login;
      cipher.notes = this.getValueOrDefault(value.notes);
      cipher.name = this.getValueOrDefault(value.name, "--");
      try {
        cipher.reprompt = parseInt(
          this.getValueOrDefault(value.reprompt, CipherRepromptType.None.toString()),
          10,
        ) as CipherRepromptType;
      } catch (e) {
        // eslint-disable-next-line
        console.error("Unable to parse reprompt value", e);
        cipher.reprompt = CipherRepromptType.None;
      }

      if (!this.isNullOrWhitespace(value.fields)) {
        const fields = this.splitNewLine(value.fields);
        for (let i = 0; i < fields.length; i++) {
          if (this.isNullOrWhitespace(fields[i])) {
            continue;
          }

          const delimPosition = fields[i].lastIndexOf(": ");
          if (delimPosition === -1) {
            continue;
          }

          if (cipher.fields == null) {
            cipher.fields = [];
          }

          const field = new FieldView();
          field.name = fields[i].substr(0, delimPosition);
          field.value = null;
          field.type = FieldType.Text;
          if (fields[i].length > delimPosition + 2) {
            field.value = fields[i].substr(delimPosition + 2);
          }
          cipher.fields.push(field);
        }
      }

      const valueType = value.type != null ? value.type.toLowerCase() : null;
      switch (valueType) {
        case "note":
          cipher.type = CipherType.SecureNote;
          cipher.secureNote = new SecureNoteView();
          cipher.secureNote.type = SecureNoteType.Generic;
          break;
        default: {
          cipher.type = CipherType.Login;
          cipher.login = new LoginView();
          cipher.login.totp = this.getValueOrDefault(value.login_totp || value.totp);
          cipher.login.username = this.getValueOrDefault(value.login_username || value.username);
          cipher.login.password = this.getValueOrDefault(value.login_password || value.password);
          const uris = this.parseSingleRowCsv(value.login_uri || value.uri);
          cipher.login.uris = this.makeUriArray(uris);
          break;
        }
      }

      result.ciphers.push(cipher);
    });

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }
}
