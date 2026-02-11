/**
 * @jest-environment node
 */
import { CipherType } from "@bitwarden/common/vault/enums";
import { FieldType } from "@bitwarden/common/vault/enums/field-type.enum";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

import { ImportResult } from "../../models";

import { Vault } from "./access";
import { SyncDownResponse } from "./access/generated/SyncDown";
import * as fixture from "./access/keeper-vault-fixture.json";
import { KeeperDirectImporter } from "./keeper-direct-importer";

describe("Keeper Direct Importer", () => {
  let vault: Vault;
  let importer: KeeperDirectImporter;

  beforeAll(async () => {
    // Disable the logging. The SSH key parsing will log errors for invalid keys during tests.
    jest.spyOn(console, "warn").mockImplementation();

    const response = SyncDownResponse.fromBinary(Buffer.from(fixture.response, "base64"));
    vault = new (Vault as any)(new Uint8Array(Buffer.from(fixture.masterKey, "base64")));
    await (vault as any).processMergedSyncDownResponse(response);
    importer = new KeeperDirectImporter();
  });

  describe("with shared folders", () => {
    let result: ImportResult;

    beforeAll(() => {
      result = importer.convertVaultToImportResult(vault, true);
    });

    it("should succeed", () => {
      expect(result.success).toBe(true);
    });

    it("should import all records as ciphers", () => {
      expect(result.ciphers.length).toBe(78);
    });

    it("should create folders from shared folders", () => {
      expect(result.folders.length).toBeGreaterThan(0);
      const folderNames = result.folders.map((f) => f.name);
      expect(folderNames).toContain("Inheritance");
      expect(folderNames).toContain("Marketing");
    });

    it("should create folder relationships for shared folder records", () => {
      expect(result.folderRelationships.length).toBeGreaterThan(0);
    });
  });

  describe("without shared folders", () => {
    let result: ImportResult;

    beforeAll(() => {
      result = importer.convertVaultToImportResult(vault, false);
    });

    it("should succeed", () => {
      expect(result.success).toBe(true);
    });

    it("should exclude shared folder records", () => {
      expect(result.ciphers.length).toBeLessThan(78);
      expect(result.ciphers.length).toBe(61);
    });

    it("should not create any folders", () => {
      expect(result.folders.length).toBe(0);
      expect(result.folderRelationships.length).toBe(0);
    });
  });

  describe("login cipher conversion", () => {
    let result: ImportResult;

    beforeAll(() => {
      result = importer.convertVaultToImportResult(vault, true);
    });

    it("should convert login with all fields", () => {
      const cipher = findCipher(result, "Amazon Sign-In");
      expect(cipher.type).toBe(CipherType.Login);
      expect(cipher.login.username).toBe("dflinn@bitwarden.com");
      expect(cipher.login.password).toBe("sSd{..Lj34+s,9F}Q(1S");
      expect(cipher.login.uris).toHaveLength(1);
      expect(cipher.login.uris[0].uri).toBe("https://www.amazon.com/ap/signin");
    });

    it("should convert login with notes", () => {
      const cipher = findCipher(result, "cipher item");
      expect(cipher.type).toBe(CipherType.Login);
      expect(cipher.login.username).toBe("username123");
      expect(cipher.login.password).toBe("password123");
      expect(cipher.notes).toBe("the quick brown fox jumps over the lazy dog.");
    });

    it("should convert login with TOTP", () => {
      const cipher = findCipher(result, "TOTP Test Item");
      expect(cipher.type).toBe(CipherType.Login);
      expect(cipher.login.totp).toContain("secret=PCP27OAIJORGCMLM");
    });

    it("should convert record with only title as secure note", () => {
      const cipher = findCipher(result, "abc 1");
      expect(cipher.type).toBe(CipherType.SecureNote);
      expect(cipher.login).toBeNull();
      expect(cipher.secureNote).toBeDefined();
    });

    it("should prepend http:// to URLs without protocol", () => {
      const cipher = findCipher(result, "codepen");
      expect(cipher.login.uris[0].uri).toBe("http://codepen.io");
    });

    it("should convert login with special characters in password", () => {
      const cipher = findCipher(result, "Sign in | CVS Health");
      expect(cipher.login.password).toBe(")ybR(o)t?pa@}Z1Y<3u@");
    });

    it("should set name to -- for records with empty title", () => {
      for (const cipher of result.ciphers) {
        expect(cipher.name).toBeTruthy();
      }
    });

    it("should set notes to null when empty", () => {
      const cipher = findCipher(result, "Amazon Sign-In");
      expect(cipher.notes).toBeNull();
    });

    it("should convert login with multiple TOTP codes", () => {
      // There are 3 records named "Comp Test", find the one with the password
      const cipher = result.ciphers.find(
        (c) => c.name === "Comp Test" && c.login?.password === "l3}9%aI6Hh33k2CJcsXB",
      );
      expect(cipher).toBeDefined();
      expect(cipher!.type).toBe(CipherType.Login);
      expect(cipher!.login.username).toBe("test");
      expect(cipher!.login.totp).toContain("secret=YW6CMSUJOHCE3H33");

      // Second TOTP code becomes a hidden field
      const totpField = getField(cipher!, "TOTP");
      expect(totpField).toBeDefined();
      expect(totpField!.value).toContain("secret=6whhjvsb3taxmlf4e7fk4v7lsusuv2m5");
      expect(totpField!.type).toBe(FieldType.Hidden);
    });
  });

  describe("card cipher conversion", () => {
    let result: ImportResult;

    beforeAll(() => {
      result = importer.convertVaultToImportResult(vault, true);
    });

    it("should convert bank card record as card cipher", () => {
      const cipher = findCipher(result, "VISA");
      expect(cipher.type).toBe(CipherType.Card);
      expect(cipher.login).toBeNull();
      expect(cipher.card).toBeDefined();
    });

    it("should extract card number and cardholder name", () => {
      const cipher = findCipher(result, "VISA");
      expect(cipher.card.number).toBe("5555555555555555");
      expect(cipher.card.cardholderName).toBe("Ted Lasso");
    });

    it("should extract card expiration date", () => {
      const cipher = findCipher(result, "VISA");
      expect(cipher.card.expMonth).toBe("02");
      expect(cipher.card.expYear).toBe("2028");
    });

    it("should extract PIN as hidden field", () => {
      const cipher = findCipher(result, "VISA");
      const pinField = getField(cipher, "PIN");
      expect(pinField).toBeDefined();
      expect(pinField!.value).toBe("1235");
      expect(pinField!.type).toBe(FieldType.Hidden);
    });
  });

  describe("non-login cipher conversion", () => {
    let result: ImportResult;

    beforeAll(() => {
      result = importer.convertVaultToImportResult(vault, true);
    });

    it("should convert address record as secure note", () => {
      const cipher = findCipher(result, "Test address");
      expect(cipher.type).toBe(CipherType.SecureNote);
      expect(cipher.login).toBeNull();
      expect(cipher.secureNote).toBeDefined();
    });

    it("should convert contact record as secure note", () => {
      const cipher = findCipher(result, "Test person");
      expect(cipher.type).toBe(CipherType.SecureNote);
      expect(cipher.login).toBeNull();
    });

    it("should store non-login fields as custom fields on secure notes", () => {
      const cipher = findCipher(result, "Test address");
      expect(cipher.fields).not.toBeNull();
      expect(cipher.fields!.length).toBeGreaterThan(0);
    });
  });

  describe("SSH key cipher conversion", () => {
    let result: ImportResult;

    beforeAll(() => {
      // import_ssh_key from sdk-internal doesn't work in the test environment,
      // so sshKeys records fall back to SecureNote with expanded key fields.
      jest.spyOn(console, "warn").mockImplementation();
      result = importer.convertVaultToImportResult(vault, true);
    });

    it("should fall back to secure note when import_ssh_key fails", () => {
      const cipher = findCipher(result, "GitHub");
      expect(cipher.type).toBe(CipherType.SecureNote);
      expect(cipher.login).toBeNull();
      expect(cipher.secureNote).toBeDefined();
    });

    it("should expand key pair into public and private key fields", () => {
      const cipher = findCipher(result, "GitHub");
      const publicKeyField = getField(cipher, "Public key");
      expect(publicKeyField).toBeDefined();
      expect(publicKeyField!.value).toContain("ssh-rsa");

      const privateKeyField = getField(cipher, "Private key");
      expect(privateKeyField).toBeDefined();
      expect(privateKeyField!.value).toContain("BEGIN RSA PRIVATE KEY");
      expect(privateKeyField!.type).toBe(FieldType.Hidden);
    });
  });

  describe("organization import", () => {
    let result: ImportResult;

    beforeAll(() => {
      jest.spyOn(console, "warn").mockImplementation();
      const orgImporter = new KeeperDirectImporter();
      orgImporter.organizationId = "test-org-id" as any;
      result = orgImporter.convertVaultToImportResult(vault, true);
    });

    it("should move folders to collections", () => {
      expect(result.collections.length).toBeGreaterThan(0);
      expect(result.folders.length).toBe(0);
    });
  });

  describe("custom fields", () => {
    let result: ImportResult;

    beforeAll(() => {
      jest.spyOn(console, "warn").mockImplementation();
      result = importer.convertVaultToImportResult(vault, true);
    });

    it("should convert custom text field", () => {
      const cipher = findCipher(result, "cipher item");
      expect(cipher.fields).not.toBeNull();
      const field = cipher.fields!.find((f) => f.value === "custom");
      expect(field).toBeDefined();
    });

    it("should convert passkey as custom field on login", () => {
      const cipher = findCipher(result, "df test passkey");
      expect(cipher.type).toBe(CipherType.Login);
      expect(cipher.fields).not.toBeNull();
      const passkeyField = cipher.fields!.find((f) => f.name === "passkey");
      expect(passkeyField).toBeDefined();
    });

    it("should format address as comma-separated string", () => {
      const cipher = findCipher(result, "Test address");
      const addressField = getField(cipher, "address");
      expect(addressField).toBeDefined();
      expect(addressField!.value).toBe("12234 Oak st, Portland, Maine, 97245, US");
    });

    it("should format name as space-separated string", () => {
      const cipher = findCipher(result, "Test person");
      const nameField = getField(cipher, "name");
      expect(nameField).toBeDefined();
      expect(nameField!.value).toBe("Ted Lassso");
    });

    it("should format phone number", () => {
      const cipher = findCipher(result, "Test person");
      const phoneField = getField(cipher, "phone");
      expect(phoneField).toBeDefined();
      expect(phoneField!.value).toBe("1234567899");
    });

    it("should have empty fields array when no custom fields exist", () => {
      const cipher = findCipher(result, "Amazon Sign-In");
      expect(cipher.fields).toHaveLength(0);
    });
  });

  //
  // Helpers
  //

  function findCipher(result: ImportResult, name: string): CipherView {
    const cipher = result.ciphers.find((c) => c.name === name);
    if (!cipher) {
      throw new Error(`Cipher not found: ${name}`);
    }
    return cipher;
  }

  function getField(cipher: CipherView, name: string): FieldView | undefined {
    return cipher.fields?.find((f) => f.name === name);
  }
});
