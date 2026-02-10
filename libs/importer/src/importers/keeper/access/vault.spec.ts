/**
 * @jest-environment node
 */
import { Vault, VaultRecord } from "../../keeper/access";

import { SyncDownResponse } from "./generated/SyncDown";
import * as fixture from "./keeper-vault-fixture.json";

describe("Keeper Vault", () => {
  let vault: Vault;

  beforeAll(async () => {
    const bytes = Buffer.from(fixture.response, "base64");
    const response = SyncDownResponse.fromBinary(bytes);

    vault = new (Vault as any)(new Uint8Array(Buffer.from(fixture.masterKey, "base64")));
    await (vault as any).processMergedSyncDownResponse(response);
  });

  function findRecord(title: string): VaultRecord {
    const record = vault.getRecords().find((r) => r.title === title);
    if (!record) {
      throw new Error(`Record not found: ${title}`);
    }
    return record;
  }

  function findRecordByType(type: string): VaultRecord {
    const record = vault.getRecords().find((r) => r.type === type);
    if (!record) {
      throw new Error(`Record with type not found: ${type}`);
    }
    return record;
  }

  it("should decrypt all records", () => {
    expect(vault.getRecords().length).toBe(78);
  });

  it("should decrypt all folders", () => {
    expect(vault.getFolders().length).toBe(8);
  });

  it("should decrypt all shared folders", () => {
    expect(vault.getSharedFolders().length).toBe(9);
  });

  describe("login records", () => {
    it("should decrypt login with all fields", () => {
      const record = findRecord("Amazon Sign-In");
      expect(record.type).toBe("login");
      expect(record.login).toBe("dflinn@bitwarden.com");
      expect(record.password).toBe("sSd{..Lj34+s,9F}Q(1S");
      expect(record.url).toBe("https://www.amazon.com/ap/signin");
    });

    it("should decrypt login with notes and custom text field", () => {
      const record = findRecord("cipher item");
      expect(record.type).toBe("login");
      expect(record.login).toBe("username123");
      expect(record.password).toBe("password123");
      expect(record.notes).toBe("the quick brown fox jumps over the lazy dog.");

      const textField = record.customFields.find((f) => f.type === "text");
      expect(textField).toBeDefined();
      expect(textField!.value[0]).toBe("custom");
    });

    it("should decrypt login with only password", () => {
      const record = findRecord("Generator test");
      expect(record.type).toBe("login");
      expect(record.login).toBe("");
      expect(record.password).toBe("password");
    });

    it("should decrypt login with only title", () => {
      const record = findRecord("abc 1");
      expect(record.type).toBe("login");
      expect(record.login).toBe("");
      expect(record.password).toBe("");
      expect(record.url).toBe("");
    });

    it("should decrypt login with multiline notes", () => {
      const record = findRecord("Nested 1");
      expect(record.login).toBe("one@nested.com");
      expect(record.password).toBe("AUk%fp8w+LDS=yVCrhB0");
      expect(record.url).toBe("https://item.com");
      expect(record.notes).toBe("a\nb\nc\nx\nasf");
    });

    it("should decrypt login with special characters in password", () => {
      const record = findRecord("Sign in | CVS Health");
      expect(record.login).toBe("garrisonconsultingcorp@gmail.com");
      expect(record.password).toBe(")ybR(o)t?pa@}Z1Y<3u@");
      expect(record.url).toBe("https://www.cvs.com/account/login");
    });

    it("should decrypt login in shared folder", () => {
      const record = findRecord("Sensitive Login Credential");
      expect(record.login).toBe("UpdatedSensitiveemail@email.com");
      expect(record.password).toBe("8`<h_'-VrJWPH3QiuCE`");
      expect(record.sharedFolderUid).toBeTruthy();
    });
  });

  describe("login with TOTP", () => {
    it("should decrypt login with single TOTP", () => {
      const record = findRecord("TOTP Test Item");
      expect(record.password).toBe("QOR$e0<oYY@z?4=A?+BR");

      const totpField = record.fields.find((f) => f.type === "oneTimeCode");
      expect(totpField).toBeDefined();
      expect(totpField!.value[0]).toContain("secret=PCP27OAIJORGCMLM");
    });

    it("should decrypt login with TOTP and all login fields", () => {
      const record = findRecord("Facebook26");
      expect(record.login).toBe("username@email.com");
      expect(record.password).toBe("T6wzV^>#dgHiV9P9S3dl");
      expect(record.url).toBe("https://facebook.com/login");

      const totpField = record.fields.find((f) => f.type === "oneTimeCode");
      expect(totpField).toBeDefined();
      expect(totpField!.value[0]).toContain("secret=6whhjvsb3taxmlf4e7fk4v7lsusuv2m5");
    });

    it("should decrypt login with TOTP without issuer", () => {
      const record = findRecord("Taco Bell");
      expect(record.password).toBe("test12345");
      expect(record.url).toBe("https://tacobell.com");

      const totpField = record.fields.find((f) => f.type === "oneTimeCode");
      expect(totpField).toBeDefined();
      expect(totpField!.value[0]).toContain("secret=DFHDFR6T76U6");
    });

    it("should decrypt login with multiple TOTP codes", () => {
      // "Comp Test" uid 14 has two TOTP URIs
      const records = vault
        .getRecords()
        .filter(
          (r) =>
            r.title === "Comp Test" &&
            r.fields.some((f) => f.type === "oneTimeCode" && f.value.length === 2),
        );
      expect(records.length).toBe(1);

      const record = records[0];
      expect(record.login).toBe("test");
      expect(record.password).toBe("l3}9%aI6Hh33k2CJcsXB");

      const totpField = record.fields.find((f) => f.type === "oneTimeCode");
      expect(totpField).toBeDefined();
      expect(totpField!.value.length).toBe(2);
    });
  });

  describe("login with passkey", () => {
    it("should decrypt login with passkey", () => {
      const record = findRecord("df test passkey");
      expect(record.login).toBe("dflinn@bitwarden.com");
      expect(record.url).toBe("https://webauthn.io/");

      const passkeyField = record.fields.find((f) => f.type === "passkey");
      expect(passkeyField).toBeDefined();

      const passkey = passkeyField!.value[0] as Record<string, unknown>;
      expect(passkey.relyingParty).toBe("webauthn.io");
      expect(passkey.username).toBe("dflinn@bitwarden.com");
      expect(passkey.credentialId).toBe("emT9hUJ733PIQh2RapEu-23WYzUnNamXIxtD9fCkEbk");
    });

    it("should decrypt login with passkey and password", () => {
      const record = findRecord("Sign up — Shopify");
      expect(record.login).toBe("garrisonconsultingcorp+1@gmail.com");
      expect(record.password).toBe("1OudC7+fChM9SC{77(vm");
      expect(record.url).toBe("https://accounts.shopify.com/signup");

      const passkeyField = record.fields.find((f) => f.type === "passkey");
      expect(passkeyField).toBeDefined();

      const passkey = passkeyField!.value[0] as Record<string, unknown>;
      expect(passkey.relyingParty).toBe("accounts.shopify.com");
      expect(passkey.username).toBe("garrisonconsultingcorp+1@gmail.com");
    });
  });

  describe("SSH key records", () => {
    it("should decrypt SSH key record", () => {
      const record = findRecordByType("sshKeys");
      expect(record.title).toBe("GitHub");

      const keyPairField = record.fields.find((f) => f.type === "keyPair");
      expect(keyPairField).toBeDefined();

      const keyPair = keyPairField!.value[0] as Record<string, unknown>;
      expect(keyPair.publicKey).toContain("ssh-rsa AAAA");
      expect(keyPair.privateKey).toContain("BEGIN RSA PRIVATE KEY");
    });
  });

  describe("address records", () => {
    it("should decrypt address record", () => {
      const record = findRecord("Test address");
      expect(record.type).toBe("address");

      const addressField = record.fields.find((f) => f.type === "address");
      expect(addressField).toBeDefined();

      const addr = addressField!.value[0] as Record<string, unknown>;
      expect(addr.street1).toBe("12234 Oak st");
      expect(addr.city).toBe("Portland");
      expect(addr.state).toBe("Maine");
      expect(addr.zip).toBe("97245");
      expect(addr.country).toBe("US");
    });
  });

  describe("contact records", () => {
    it("should decrypt contact record with name, email, phone, and company", () => {
      const record = findRecord("Test person");
      expect(record.type).toBe("contact");

      const nameField = record.fields.find((f) => f.type === "name");
      expect(nameField).toBeDefined();
      const name = nameField!.value[0] as Record<string, unknown>;
      expect(name.first).toBe("Ted");
      expect(name.last).toBe("Lassso");

      const emailField = record.fields.find((f) => f.type === "email");
      expect(emailField).toBeDefined();
      expect(emailField!.value[0]).toBe("ted@greyhounds.io");

      const phoneField = record.fields.find((f) => f.type === "phone");
      expect(phoneField).toBeDefined();
      const phone = phoneField!.value[0] as Record<string, unknown>;
      expect(phone.number).toBe("1234567899");

      const companyField = record.fields.find((f) => f.type === "text" && f.label === "company");
      expect(companyField).toBeDefined();
      expect(companyField!.value[0]).toBe("Greyhounds");
    });
  });

  describe("bank card records", () => {
    it("should decrypt bank card with payment card, cardholder, and PIN", () => {
      const record = findRecord("VISA");
      expect(record.type).toBe("bankCard");

      const cardField = record.fields.find((f) => f.type === "paymentCard");
      expect(cardField).toBeDefined();
      const card = cardField!.value[0] as Record<string, unknown>;
      expect(card.cardNumber).toBe("5555555555555555");
      expect(card.cardExpirationDate).toBe("02/2028");
      expect(card.cardSecurityCode).toBe("123");

      const holderField = record.fields.find(
        (f) => f.type === "text" && f.label === "cardholderName",
      );
      expect(holderField).toBeDefined();
      expect(holderField!.value[0]).toBe("Ted Lasso");

      const pinField = record.fields.find((f) => f.type === "pinCode");
      expect(pinField).toBeDefined();
      expect(pinField!.value[0]).toBe("1235");
    });
  });

  describe("shared folders", () => {
    it("should contain expected shared folder names", () => {
      const names = vault
        .getSharedFolders()
        .map((f) => f.name)
        .sort();
      expect(names).toContain("Inheritance");
      expect(names).toContain("Marketing");
      expect(names).toContain("Shared Project Folder");
      expect(names).toContain("abc");
    });
  });
});
