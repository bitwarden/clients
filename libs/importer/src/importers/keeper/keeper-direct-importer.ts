import { CipherType } from "@bitwarden/common/vault/enums";
import { FieldType } from "@bitwarden/common/vault/enums/field-type.enum";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";

import { ImportResult } from "../../models";
import { BaseImporter } from "../base-importer";

import { Vault, VaultField, VaultRecord, VaultSharedFolder } from "./access";

export class KeeperDirectImporter extends BaseImporter {
  convertVaultToImportResult(vault: Vault, includeSharedFolders: boolean): ImportResult {
    const result = new ImportResult();

    const sharedFolderMap = new Map<string, VaultSharedFolder>();
    for (const sharedFolder of vault.getSharedFolders()) {
      sharedFolderMap.set(sharedFolder.uid, sharedFolder);
    }

    for (const record of vault.getRecords()) {
      if (!includeSharedFolders && record.sharedFolderUid) {
        continue;
      }

      const cipher = this.convertRecordToCipher(record);

      if (record.sharedFolderUid && includeSharedFolders) {
        const sharedFolder = sharedFolderMap.get(record.sharedFolderUid);
        if (sharedFolder?.name) {
          this.processFolder(result, sharedFolder.name);
        }
      }

      result.ciphers.push(cipher);
    }

    result.success = true;
    return result;
  }

  private convertRecordToCipher(record: VaultRecord): CipherView {
    const cipher = this.initLoginCipher();
    cipher.name = this.getValueOrDefault(record.title, "--");
    cipher.notes = this.getValueOrDefault(record.notes);
    cipher.login.username = this.getValueOrDefault(record.login);
    cipher.login.password = this.getValueOrDefault(record.password);
    cipher.login.uris = this.makeUriArray(record.url);

    // Track consumed fields by index so they aren't processed again
    const consumedFieldIndices = new Set<number>();

    // Handle special record types
    switch (record.type) {
      case "bankCard":
        this.importBankCard(record, cipher, consumedFieldIndices);
        break;
      // TODO: sshKeys → SshKey (requires import_ssh_key from sdk-internal)
      // TODO: Reference resolution between records
      // TODO: Organization/collection support (moveFoldersToCollections)
      // TODO: Personal folder support (requires vault userFolderRecords)
      // TODO: Nested shared folder paths
    }

    // Process standard fields
    for (let i = 0; i < record.fields.length; i++) {
      if (consumedFieldIndices.has(i)) {
        continue;
      }
      const field = record.fields[i];
      // Skip fields already extracted into record.login/password/url
      if (field.type === "login" || field.type === "password" || field.type === "url") {
        continue;
      }
      this.processVaultField(cipher, field);
    }

    // Process custom fields
    for (const field of record.customFields) {
      this.processVaultField(cipher, field);
    }

    this.convertToNoteIfNeeded(cipher);
    this.cleanupCipher(cipher);

    return cipher;
  }

  private importBankCard(
    record: VaultRecord,
    cipher: CipherView,
    consumedFieldIndices: Set<number>,
  ): void {
    cipher.type = CipherType.Card;
    cipher.card = new CardView();

    for (let i = 0; i < record.fields.length; i++) {
      const field = record.fields[i];

      if (field.type === "paymentCard" && field.value.length > 0) {
        const card = field.value[0] as {
          cardNumber?: string;
          cardExpirationDate?: string;
          cardSecurityCode?: string;
        };
        cipher.card.number = card.cardNumber || null;
        cipher.card.code = card.cardSecurityCode || null;
        cipher.card.brand = CardView.getCardBrandByPatterns(cipher.card.number);

        if (card.cardExpirationDate) {
          const parts = card.cardExpirationDate.split("/");
          if (parts.length === 2) {
            cipher.card.expMonth = parts[0];
            cipher.card.expYear = parts[1];
          }
        }
        consumedFieldIndices.add(i);
      } else if (
        field.type === "text" &&
        field.label === "cardholderName" &&
        field.value.length > 0
      ) {
        cipher.card.cardholderName = String(field.value[0]);
        consumedFieldIndices.add(i);
      } else if (field.type === "pinCode" && field.value.length > 0) {
        this.addField(cipher, "PIN", String(field.value[0]), FieldType.Hidden);
        consumedFieldIndices.add(i);
      }
    }

    // Copy login properties as custom fields since Card cipher doesn't use them
    this.copyLoginPropertiesAsCustomFields(cipher);
  }

  private copyLoginPropertiesAsCustomFields(cipher: CipherView): void {
    if (!this.isNullOrWhitespace(cipher.login?.username)) {
      this.addField(cipher, "Username", cipher.login.username!);
      cipher.login.username = null;
    }

    if (!this.isNullOrWhitespace(cipher.login?.password)) {
      this.addField(cipher, "Password", cipher.login.password!, FieldType.Hidden);
      cipher.login.password = null;
    }

    if (cipher.login?.uris) {
      for (const uri of cipher.login.uris) {
        this.addField(cipher, "URL", uri.uri);
      }
      cipher.login.uris = null;
    }
  }

  private processVaultField(cipher: CipherView, field: VaultField): void {
    if (!field.value || field.value.length === 0) {
      return;
    }

    const name = field.label || field.type;

    switch (field.type) {
      case "oneTimeCode":
        this.importOneTimeCode(cipher, field.value);
        break;

      case "url":
        this.importUrl(cipher, field.value);
        break;

      case "host":
        for (const v of field.value) {
          const { hostName, port } = v as { hostName?: string; port?: string };
          this.addField(cipher, "Hostname", hostName);
          this.addField(cipher, "Port", port);
        }
        break;

      case "keyPair":
        for (const v of field.value) {
          const { publicKey, privateKey } = v as { publicKey?: string; privateKey?: string };
          this.addField(cipher, "Public key", publicKey);
          this.addField(cipher, "Private key", privateKey, FieldType.Hidden);
        }
        break;

      case "securityQuestion":
        for (const v of field.value) {
          const { question, answer } = v as { question?: string; answer?: string };
          this.addField(cipher, "Security question", question);
          this.addField(cipher, "Security question answer", answer, FieldType.Hidden);
        }
        break;

      case "appFiller":
        // Ignored - Keeper internal field
        break;

      case "name":
        for (const v of field.value) {
          const { first, middle, last } = v as { first?: string; middle?: string; last?: string };
          this.addField(
            cipher,
            name,
            [first, middle, last]
              .filter((x) => x)
              .join(" ")
              .trim(),
          );
        }
        break;

      case "address":
        for (const v of field.value) {
          const { street1, street2, city, state, zip, country } = v as {
            street1?: string;
            street2?: string;
            city?: string;
            state?: string;
            zip?: string;
            country?: string;
          };
          this.addField(
            cipher,
            name,
            [street1, street2, city, state, zip, country]
              .filter((x) => x)
              .join(", ")
              .trim(),
          );
        }
        break;

      case "phone":
        for (const v of field.value) {
          const { region, number, ext, type } = v as {
            region?: string;
            number?: string;
            ext?: string;
            type?: string;
          };
          const parts: string[] = [];
          if (region) {
            parts.push(`(${region})`);
          }
          if (number) {
            parts.push(number);
          }
          if (ext) {
            parts.push(`ext. ${ext}`);
          }
          if (type) {
            parts.push(`(${type})`);
          }
          this.addField(cipher, name, parts.join(" ").trim());
        }
        break;

      case "bankAccount":
        for (const v of field.value) {
          const { accountType, otherType, accountNumber, routingNumber } = v as {
            accountType?: string;
            otherType?: string;
            accountNumber?: string;
            routingNumber?: string;
          };
          const parts: string[] = [];
          const acctType = otherType || accountType;
          if (acctType) {
            parts.push(`Type: ${acctType}`);
          }
          if (accountNumber) {
            parts.push(`Account Number: ${accountNumber}`);
          }
          if (routingNumber) {
            parts.push(`Routing Number: ${routingNumber}`);
          }
          this.addField(cipher, name, parts.join(", ").trim());
        }
        break;

      case "date":
      case "birthDate":
      case "expirationDate":
        for (const v of field.value) {
          this.addField(cipher, name, this.parseDate(v));
        }
        break;

      case "pinCode":
      case "secret":
        for (const v of field.value) {
          this.addField(cipher, name, this.convertToFieldValue(v), FieldType.Hidden);
        }
        break;

      default:
        for (const v of field.value) {
          this.addField(cipher, name, this.convertToFieldValue(v));
        }
        break;
    }
  }

  private importOneTimeCode(cipher: CipherView, values: unknown[]): void {
    const codes = values.map((v) => String(v));

    // Login has a dedicated TOTP field. First code goes there.
    if (cipher.type === CipherType.Login && !cipher.login.totp && codes.length > 0) {
      cipher.login.totp = codes.shift()!;
    }

    // Additional codes become hidden fields
    for (const code of codes) {
      this.addField(cipher, "TOTP", code, FieldType.Hidden);
    }
  }

  private importUrl(cipher: CipherView, values: unknown[]): void {
    for (const v of values) {
      const uri = String(v);
      if (this.isNullOrWhitespace(uri)) {
        continue;
      }

      if (cipher.type === CipherType.Login) {
        const uriView = new LoginUriView();
        uriView.uri = this.fixUri(uri);
        if (!this.isNullOrWhitespace(uriView.uri)) {
          if (!cipher.login.uris) {
            cipher.login.uris = [];
          }
          cipher.login.uris.push(uriView);
        }
      } else {
        this.addField(cipher, "URL", uri);
      }
    }
  }

  private addField(
    cipher: CipherView,
    name: string,
    value: string | undefined | null,
    type: FieldType = FieldType.Text,
  ): void {
    if (!value) {
      return;
    }

    const field = new FieldView();
    field.name = name;
    field.value = value;
    field.type = type;
    cipher.fields.push(field);
  }

  private convertToFieldValue(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  private parseDate(value: unknown): string {
    const date = new Date(value as string | number);
    return isNaN(date.getTime()) ? "" : date.toLocaleString();
  }
}
