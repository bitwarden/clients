import { makeStaticByteArray } from "../../../../spec";
import { EncryptionType } from "../../enums";

import { SymmetricCryptoKey } from "./symmetric-crypto-key";

describe("SymmetricCryptoKey", () => {
  it("errors if no key", () => {
    const t = () => {
      new SymmetricCryptoKey(null);
    };

    expect(t).toThrowError("Must provide key");
  });

  describe("guesses encKey from key length", () => {
    it("AesCbc256_B64", () => {
      const key = makeStaticByteArray(32);
      const cryptoKey = new SymmetricCryptoKey(key);

      expect(cryptoKey).toEqual({
        encKey: key,
        encKeyB64: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
        encType: EncryptionType.AesCbc256_B64,
        key: key,
        keyB64: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
        macKey: null,
      });
    });

    it("AesCbc128_HmacSha256_B64", () => {
      const key = makeStaticByteArray(32);
      const cryptoKey = new SymmetricCryptoKey(key, EncryptionType.AesCbc128_HmacSha256_B64);

      expect(cryptoKey).toEqual({
        encKey: key.slice(0, 16),
        encKeyB64: "AAECAwQFBgcICQoLDA0ODw==",
        encType: 1,
        key: key,
        keyB64: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
        macKey: key.slice(16, 32),
        macKeyB64: "EBESExQVFhcYGRobHB0eHw==",
      });
    });

    it("AesCbc256_HmacSha256_B64", () => {
      const key = makeStaticByteArray(64);
      const cryptoKey = new SymmetricCryptoKey(key);

      expect(cryptoKey).toEqual({
        encKey: key.slice(0, 32),
        encKeyB64: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
        encType: EncryptionType.AesCbc256_HmacSha256_B64,
        key: key,
        keyB64:
          "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+Pw==",
        macKey: key.slice(32, 64),
        macKeyB64: "ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8=",
      });
    });

    it("unknown length", () => {
      const t = () => {
        new SymmetricCryptoKey(makeStaticByteArray(30));
      };

      expect(t).toThrowError("Unable to determine encType.");
    });
  });

  it("toJSON creates object for serialization", () => {
    const key = new SymmetricCryptoKey(makeStaticByteArray(64));
    const actual = key.toJSON();

    const expected = { keyB64: key.keyB64 };

    expect(actual).toEqual(expected);
  });

  it("fromJSON hydrates new object", () => {
    const expected = new SymmetricCryptoKey(makeStaticByteArray(64));
    const actual = SymmetricCryptoKey.fromJSON({ keyB64: expected.keyB64 });

    expect(actual).toEqual(expected);
    expect(actual).toBeInstanceOf(SymmetricCryptoKey);
  });

  describe("fromString", () => {
    it("null string returns null", () => {
      const actual = SymmetricCryptoKey.fromString(null);

      expect(actual).toBeNull();
    });

    it("base64 string creates object", () => {
      const key = makeStaticByteArray(64);
      const expected = new SymmetricCryptoKey(key);
      const actual = SymmetricCryptoKey.fromString(expected.keyB64);

      expect(actual).toEqual(expected);
      expect(actual).toBeInstanceOf(SymmetricCryptoKey);
    });
  });
});
