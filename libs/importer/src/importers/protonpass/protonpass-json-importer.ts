import { FieldType, SecureNoteType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

import {
  ProtonPassCreditCardItemContent,
  ProtonPassItemState,
  ProtonPassJsonFile,
  ProtonPassLoginItemContent,
} from "./types/protonpass-json-type";

export class ProtonPassJsonImporter extends BaseImporter implements Importer {
  constructor(private i18nService: I18nService) {
    super();
  }

  parse(data: string): Promise<ImportResult> {
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
        this.processFolder(result, vault.name);

        const cipher = this.initLoginCipher();
        cipher.name = item.data.metadata.name;
        cipher.notes = item.data.metadata.note;

        switch (item.data.type) {
          case "login": {
            const loginContent = item.data.content as ProtonPassLoginItemContent;
            cipher.login.uris = this.makeUriArray(loginContent.urls);
            cipher.login.username = loginContent.username;
            cipher.login.password = loginContent.password;
            if (loginContent.totpUri != "") {
              cipher.login.totp = new URL(loginContent.totpUri).searchParams.get("secret");
            }
            for (const extraField of item.data.extraFields) {
              this.processKvp(
                cipher,
                extraField.fieldName,
                extraField.type == "totp" ? extraField.data.totpUri : extraField.data.content,
                extraField.type == "text" ? FieldType.Text : FieldType.Hidden
              );
            }
            break;
          }
          case "note":
            cipher.type = CipherType.SecureNote;
            cipher.secureNote = new SecureNoteView();
            cipher.secureNote.type = SecureNoteType.Generic;
            break;
          case "creditCard": {
            const creditCardContent = item.data.content as ProtonPassCreditCardItemContent;
            cipher.type = CipherType.Card;
            cipher.card = new CardView();
            cipher.card.cardholderName = creditCardContent.cardholderName;
            cipher.card.number = creditCardContent.number;
            cipher.card.brand = CardView.getCardBrandByPatterns(creditCardContent.number);
            cipher.card.code = creditCardContent.verificationNumber;

            if (!this.isNullOrWhitespace(creditCardContent.expirationDate)) {
              cipher.card.expMonth = creditCardContent.expirationDate.substring(0, 2);
              cipher.card.expMonth = cipher.card.expMonth.replace(/^0+/, "");
              cipher.card.expYear = creditCardContent.expirationDate.substring(2, 6);
            }

            if (!this.isNullOrWhitespace(creditCardContent.pin)) {
              this.processKvp(cipher, "PIN", creditCardContent.pin, FieldType.Hidden);
            }

            break;
          }
        }

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
}
