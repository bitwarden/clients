/**
 * @jest-environment node
 */
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { ImportResult } from "../../models";

import { Vault } from "./access";
import { SyncDownResponse } from "./access/generated/SyncDown";
import * as fixture from "./access/keeper-vault-fixture.json";
import { convertVaultToImportResult } from "./keeper-direct-importer";

describe("Keeper Direct Importer", () => {
  let vault: Vault;

  beforeAll(async () => {
    // Create a vault
    const response = SyncDownResponse.fromBinary(Buffer.from(fixture.response, "base64"));
    vault = new (Vault as any)(new Uint8Array(Buffer.from(fixture.masterKey, "base64")));
    await (vault as any).processMergedSyncDownResponse(response);
  });

  describe("with shared folders", () => {
    let result: ImportResult;

    beforeAll(() => {
      result = convertVaultToImportResult(vault, true);
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
      result = convertVaultToImportResult(vault, false);
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
      result = convertVaultToImportResult(vault, true);
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

    it("should convert login with only title as login cipher", () => {
      const cipher = findCipher(result, "abc 1");
      expect(cipher.type).toBe(CipherType.Login);
      expect(cipher.login.username).toBeNull();
      expect(cipher.login.password).toBeNull();
      expect(cipher.login.uris).toBeNull();
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
  });

  describe("non-login cipher conversion", () => {
    let result: ImportResult;

    beforeAll(() => {
      result = convertVaultToImportResult(vault, true);
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

    it("should convert bank card record as secure note", () => {
      const cipher = findCipher(result, "VISA");
      expect(cipher.type).toBe(CipherType.SecureNote);
      expect(cipher.login).toBeNull();
    });

    it("should store non-login fields as custom fields on secure notes", () => {
      const cipher = findCipher(result, "Test address");
      expect(cipher.fields).not.toBeNull();
      expect(cipher.fields!.length).toBeGreaterThan(0);
    });
  });

  describe("custom fields", () => {
    let result: ImportResult;

    beforeAll(() => {
      result = convertVaultToImportResult(vault, true);
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

    it("should convert SSH key pair as custom fields", () => {
      const cipher = findCipher(result, "GitHub");
      expect(cipher.fields).not.toBeNull();
      const keyPairField = cipher.fields!.find((f) => f.name === "keyPair");
      expect(keyPairField).toBeDefined();
    });

    it("should not create fields array when no custom fields exist", () => {
      const cipher = findCipher(result, "Amazon Sign-In");
      expect(cipher.fields).toBeNull();
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
});
