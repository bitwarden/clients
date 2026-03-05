import { makeStaticByteArray } from "../../../../spec";
import { EncryptionType } from "../../enums";
import { Utils } from "../../misc/utils";

import { Aes256CbcHmacKey, SymmetricCryptoKey } from "./symmetric-crypto-key";

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
        keyB64: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
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
        keyB64:
          "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+Pw==",
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
      encryptionKey: key.inner().encryptionKey,
      authenticationKey: (key.inner() as Aes256CbcHmacKey).authenticationKey,
    });
  });

  it("toEncoded returns encoded key for AesCbc256_B64", () => {
    const key = new SymmetricCryptoKey(makeStaticByteArray(32));
    const actual = key.toEncoded();

    expect(actual).toEqual(key.inner().encryptionKey);
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
