import { makeStaticByteArray } from "../../../../spec";
import { EncryptionType } from "../../enums";
import { Utils } from "../../misc/utils";

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
        macKeyB64: undefined,
        innerKey: {
          type: EncryptionType.AesCbc256_B64,
          encryptionKey: key,
        },
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
        innerKey: {
          type: EncryptionType.AesCbc256_HmacSha256_B64,
          encryptionKey: key.slice(0, 32),
          authenticationKey: key.slice(32),
        },
      });
    });

    it("unknown length", () => {
      const t = () => {
        new SymmetricCryptoKey(makeStaticByteArray(30));
      };

      expect(t).toThrowError(`Unsupported encType/key length 30`);
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

  it("inner returns inner key", () => {
    const key = new SymmetricCryptoKey(makeStaticByteArray(64));
    const actual = key.inner();

    expect(actual).toEqual({
      type: EncryptionType.AesCbc256_HmacSha256_B64,
      encryptionKey: key.encKey,
      authenticationKey: key.macKey,
    });
  });

  it("toEncoded returns encoded key for AesCbc256_B64", () => {
    const key = new SymmetricCryptoKey(makeStaticByteArray(32));
    const actual = key.toEncoded();

    expect(actual).toEqual(key.encKey);
  });

  it("toEncoded returns encoded key for AesCbc256_HmacSha256_B64", () => {
    const keyBytes = makeStaticByteArray(64);
    const key = new SymmetricCryptoKey(keyBytes);
    const actual = key.toEncoded();

    expect(actual).toEqual(keyBytes);
  });

  it("toBase64 returns base64 encoded key", () => {
    const keyBytes = makeStaticByteArray(64);
    const keyB64 = Utils.fromBufferToB64(keyBytes);
    const key = new SymmetricCryptoKey(keyBytes);
    const actual = key.toBase64();

    expect(actual).toEqual(keyB64);
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
