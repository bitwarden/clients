import { CipherType } from "@bitwarden/common/vault/enums";
import { FieldType } from "@bitwarden/common/vault/enums/field-type.enum";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { import_ssh_key, SshKeyView } from "@bitwarden/sdk-internal";

import { ImportResult } from "../../models";
import { BaseImporter } from "../base-importer";

import { Vault, VaultField, VaultItem } from "./access";

type Reference = {
  id: string;
  type: string;
};

export class KeeperDirectImporter extends BaseImporter {
  private references = new Map<string, Reference[]>();
  private idToCipher = new Map<string, CipherView>();

  convertVaultToImportResult(vault: Vault, includeSharedFolders: boolean): ImportResult {
    const result = new ImportResult();

    this.references.clear();
    this.idToCipher.clear();

    const items = vault.getItems();
    this.parseRecords(items, result, includeSharedFolders);
    this.resolveReferences();

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return result;
  }

  private parseRecords(
    items: VaultItem[],
    result: ImportResult,
    includeSharedFolders: boolean,
  ): void {
    // TODO: Filter out shared folder records when includeSharedFolders is false
    for (const item of items) {
      this.parseRecord(item, result);
    }
  }

  private parseRecord(item: VaultItem, result: ImportResult): void {
    for (const path of item.folders) {
      this.processFolder(result, path);
    }

    const cipher = this.initLoginCipher();
    cipher.name = this.getValueOrDefault(item.title);
    cipher.notes = this.getValueOrDefault(item.notes);

    // Track consumed fields by index so they aren't processed again
    const consumedFieldIndices = new Set<number>();

    // Handle special record types
    switch (item.type) {
      case "bankCard":
        this.importBankCard(item, cipher, consumedFieldIndices);
        break;
      case "sshKeys":
        // In Bitwarden the ssh key is supposed to be valid.
        // So we only set the type if we can actually import the key.
        if (!this.importSshKey(item, cipher, consumedFieldIndices)) {
          // Otherwise, fallback to login/secure note.
          // Make sure the passphrase is not lost, if any. The key pair will be imported
          // as a custom field via the standard field processing pipeline.
          const passphrase = this.getFirstFieldValue(item, "password");
          this.addField(cipher, "Passphrase", passphrase, FieldType.Hidden);
        }
        break;
    }

    this.importFields(item, cipher, consumedFieldIndices);
    this.collectReferences(item);

    this.convertToNoteIfNeeded(cipher);
    this.cleanupCipher(cipher);

    result.ciphers.push(cipher);

    // This is needed for resolving references later
    if (item.id) {
      this.idToCipher.set(item.id, cipher);
    }
  }

  private getFirstFieldValue(item: VaultItem, fieldType: string): string | undefined {
    const field = item.fields.find((f) => f.type === fieldType);
    return field?.value.length ? String(field.value[0]) : undefined;
  }

  private importBankCard(
    record: VaultItem,
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
  }

  private importSshKey(
    record: VaultItem,
    cipher: CipherView,
    consumedFieldIndices: Set<number>,
  ): boolean {
    const keyPairIndex = record.fields.findIndex((f) => f.type === "keyPair" && f.value.length > 0);
    if (keyPairIndex === -1) {
      return false;
    }

    const keyPair = record.fields[keyPairIndex].value[0] as {
      privateKey?: string;
      publicKey?: string;
    };
    if (!keyPair.privateKey) {
      return false;
    }

    const passphrase = this.getFirstFieldValue(record, "password") ?? "";

    let keyView: SshKeyView | null = null;
    try {
      keyView = import_ssh_key(keyPair.privateKey, passphrase);
    } catch {
      this.logService.warning(`Unable to import SSH key (title: ${record.title})`);
      return false;
    }
    if (!keyView) {
      return false;
    }

    cipher.type = CipherType.SshKey;
    cipher.sshKey.privateKey = keyView.privateKey;
    cipher.sshKey.publicKey = keyView.publicKey;
    cipher.sshKey.keyFingerprint = keyView.fingerprint;

    consumedFieldIndices.add(keyPairIndex);

    // Extract host details if present
    for (let i = 0; i < record.fields.length; i++) {
      if (consumedFieldIndices.has(i)) {
        continue;
      }
      const field = record.fields[i];
      if (field.type === "host" && field.value.length > 0) {
        const { hostName, port } = field.value[0] as { hostName?: string; port?: string };
        this.addField(cipher, "Hostname", hostName);
        this.addField(cipher, "Port", port);
        consumedFieldIndices.add(i);
      }
    }

    return true;
  }

  private importFields(
    record: VaultItem,
    cipher: CipherView,
    consumedFieldIndices: Set<number>,
  ): void {
    // Process standard fields
    for (let i = 0; i < record.fields.length; i++) {
      if (consumedFieldIndices.has(i)) {
        continue;
      }
      const field = record.fields[i];
      this.importField(cipher, field);
    }

    // Process custom fields
    for (const field of record.custom) {
      this.importField(cipher, field);
    }
  }

  private collectReferences(item: VaultItem): void {
    const refs: Reference[] = [];

    for (const field of [...item.fields, ...item.custom]) {
      if (field.type.endsWith("Ref") && field.value.length > 0) {
        const type = field.type.slice(0, -3);
        for (const uid of field.value) {
          refs.push({ id: String(uid), type });
        }
      }
    }

    if (refs.length > 0) {
      this.references.set(item.id, refs);
    }
  }

  private resolveReferences(): void {
    for (const [uid, refs] of this.references) {
      const cipher = this.idToCipher.get(uid);
      if (!cipher) {
        continue;
      }

      for (const { id, type } of refs) {
        const refCipher = this.idToCipher.get(id);
        if (!refCipher) {
          continue;
        }

        const value = refCipher.fields?.find((f) => f.name === type)?.value;
        if (value) {
          this.addField(cipher, type, value);
        }
      }
    }
  }

  private importField(cipher: CipherView, field: VaultField): void {
    if (!field.value || field.value.length === 0) {
      return;
    }

    // Reference fields are resolved separately after all records are parsed
    if (field.type.endsWith("Ref")) {
      return;
    }

    if (this.tryImportArrayField(field.type, field.value, cipher)) {
      return;
    }

    const name = field.label || field.type;

    for (const value of field.value) {
      if (this.tryImportExpandingField(field.type, value, cipher)) {
        continue;
      }

      this.importSingleField(field.type, name, value, cipher);
    }
  }

  private tryImportArrayField(type: string, values: unknown[], cipher: CipherView): boolean {
    switch (type) {
      case "login":
        {
          for (const v of values) {
            const username = String(v);
            if (this.isNullOrWhitespace(username)) {
              continue;
            }
            if (cipher.type === CipherType.Login && !cipher.login.username) {
              cipher.login.username = username;
            } else {
              this.addField(cipher, "Username", username);
            }
          }
        }
        break;
      case "password":
        {
          for (const v of values) {
            const password = String(v);
            if (this.isNullOrWhitespace(password)) {
              continue;
            }
            if (cipher.type === CipherType.Login && !cipher.login.password) {
              cipher.login.password = password;
            } else {
              this.addField(cipher, "Password", password, FieldType.Hidden);
            }
          }
        }
        break;
      case "oneTimeCode":
        {
          const codes = values.map((v) => String(v));
          if (codes.length === 0) {
            break;
          }

          // Login has a dedicated TOTP field. First code goes there.
          if (cipher.type === CipherType.Login && !cipher.login.totp) {
            cipher.login.totp = codes.shift()!;
          }

          // Additional codes become hidden fields
          for (const code of codes) {
            this.addField(cipher, "TOTP", code, FieldType.Hidden);
          }
        }
        break;
      case "url":
        {
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
        break;
      default:
        return false;
    }

    return true;
  }

  private tryImportExpandingField(type: string, value: unknown, cipher: CipherView): boolean {
    switch (type) {
      case "host":
        {
          const { hostName, port } = value as { hostName?: string; port?: string };
          this.addField(cipher, "Hostname", hostName);
          this.addField(cipher, "Port", port);
        }
        break;
      case "keyPair":
        {
          const { publicKey, privateKey } = value as {
            publicKey?: string;
            privateKey?: string;
          };
          this.addField(cipher, "Public key", publicKey);
          this.addField(cipher, "Private key", privateKey, FieldType.Hidden);
        }
        break;
      case "securityQuestion":
        {
          const { question, answer } = value as { question?: string; answer?: string };
          this.addField(cipher, "Security question", question);
          this.addField(cipher, "Security question answer", answer, FieldType.Hidden);
        }
        break;
      case "appFiller":
        // Ignored - Keeper internal field
        break;
      default:
        return false;
    }

    return true;
  }

  private importSingleField(type: string, name: string, value: unknown, cipher: CipherView): void {
    let importedValue = this.convertToFieldValue(value);
    let importedType = FieldType.Text;

    switch (type) {
      case "date":
      case "birthDate":
      case "expirationDate":
        importedValue = this.parseDate(value);
        break;
      case "name":
        {
          const { first, middle, last } = value as {
            first?: string;
            middle?: string;
            last?: string;
          };
          importedValue = [first, middle, last]
            .filter((x) => x)
            .join(" ")
            .trim();
        }
        break;
      case "address":
        {
          const { street1, street2, city, state, zip, country } = value as {
            street1?: string;
            street2?: string;
            city?: string;
            state?: string;
            zip?: string;
            country?: string;
          };
          importedValue = [street1, street2, city, state, zip, country]
            .filter((x) => x)
            .join(", ")
            .trim();
        }
        break;
      case "phone":
        {
          const { region, number, ext, type } = value as {
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
          importedValue = parts.join(" ").trim();
        }
        break;
      case "bankAccount":
        {
          const { accountType, otherType, accountNumber, routingNumber } = value as {
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
          importedValue = parts.join(", ").trim();
        }
        break;
      case "pinCode":
      case "secret":
        importedType = FieldType.Hidden;
        break;
      default:
        break;
    }

    this.addField(cipher, name, importedValue, importedType);
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
    field.type = type;
    field.name = name;
    field.value = this.convertToFieldValue(value);
    cipher.fields.push(field);
  }

  private convertToFieldValue(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      // Fallthrough
    }

    return "";
  }

  private parseDate(value: unknown): string {
    const date = new Date(value as string | number);
    return isNaN(date.getTime()) ? "" : date.toLocaleString();
  }
}
