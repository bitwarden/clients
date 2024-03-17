import { mock } from "jest-mock-extended";

import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { EncryptService } from "../../../platform/abstractions/encrypt.service";
import { EncString } from "../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "../../../types/csprng";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";

import { DataPacker } from "./data-packer.abstraction";
import { SecretClassifier } from "./secret-classifier";
import { UserKeyEncryptor } from "./user-key-encryptor";

describe("UserKeyEncryptor", () => {
  const encryptService = mock<EncryptService>();
  const keyService = mock<CryptoService>();
  const dataPacker = mock<DataPacker>();
  const userKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;
  const anyUserId = "foo" as UserId;

  beforeEach(() => {
    // The UserKeyEncryptor is, in large part, a facade coordinating a handful of worker
    // objects, so its tests focus on how data flows between components. The defaults rely
    // on this property--that the facade treats its data like a opaque objects--to trace
    // the data through several function calls. Should the encryptor interact with the
    // objects themselves, it will break.
    encryptService.encrypt.mockImplementation((p) => Promise.resolve(p as unknown as EncString));
    encryptService.decryptToUtf8.mockImplementation((c) => Promise.resolve(c as unknown as string));
    keyService.getUserKey.mockImplementation(() => Promise.resolve(userKey));
    dataPacker.pack.mockImplementation((v) => v as string);
    dataPacker.unpack.mockImplementation(<T>(v: string) => v as T);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("encrypt", () => {
    it("should throw if value was not supplied", async () => {
      const classifier = SecretClassifier.allSecret<object>();
      const encryptor = new UserKeyEncryptor(encryptService, keyService, classifier, dataPacker);

      await expect(encryptor.encrypt(null, anyUserId)).rejects.toThrow(
        "value cannot be null or undefined",
      );
      await expect(encryptor.encrypt(undefined, anyUserId)).rejects.toThrow(
        "value cannot be null or undefined",
      );
    });

    it("should throw if userId was not supplied", async () => {
      const classifier = SecretClassifier.allSecret<object>();
      const encryptor = new UserKeyEncryptor(encryptService, keyService, classifier, dataPacker);

      await expect(encryptor.encrypt({} as any, null)).rejects.toThrow(
        "userId cannot be null or undefined",
      );
      await expect(encryptor.encrypt({} as any, undefined)).rejects.toThrow(
        "userId cannot be null or undefined",
      );
    });

    it("should classify data into a disclosed value and an encrypted packed value using the user's key", async () => {
      const classifier = SecretClassifier.allSecret<object>();
      const classifierClassify = jest.spyOn(classifier, "classify");
      const disclosed = {} as any;
      const secret = {} as any;
      classifierClassify.mockReturnValue({ disclosed, secret });

      const encryptor = new UserKeyEncryptor(encryptService, keyService, classifier, dataPacker);
      const value = { foo: true };

      const result = await encryptor.encrypt(value, anyUserId);

      expect(classifierClassify).toHaveBeenCalledWith(value);
      expect(keyService.getUserKey).toHaveBeenCalledWith(anyUserId);
      expect(dataPacker.pack).toHaveBeenCalledWith(secret);
      expect(encryptService.encrypt).toHaveBeenCalledWith(secret, userKey);
      expect(result.secret).toBe(secret);
      expect(result.disclosed).toBe(disclosed);
    });
  });

  describe("decrypt", () => {
    it("should throw if secret was not supplied", async () => {
      const classifier = SecretClassifier.allSecret<object>();
      const encryptor = new UserKeyEncryptor(encryptService, keyService, classifier, dataPacker);

      await expect(encryptor.decrypt(null, {} as any, anyUserId)).rejects.toThrow(
        "secret cannot be null or undefined",
      );
      await expect(encryptor.decrypt(undefined, {} as any, anyUserId)).rejects.toThrow(
        "secret cannot be null or undefined",
      );
    });

    it("should throw if disclosed was not supplied", async () => {
      const classifier = SecretClassifier.allSecret<object>();
      const encryptor = new UserKeyEncryptor(encryptService, keyService, classifier, dataPacker);

      await expect(encryptor.decrypt({} as any, null, anyUserId)).rejects.toThrow(
        "disclosed cannot be null or undefined",
      );
      await expect(encryptor.decrypt({} as any, undefined, anyUserId)).rejects.toThrow(
        "disclosed cannot be null or undefined",
      );
    });

    it("should throw if userId was not supplied", async () => {
      const classifier = SecretClassifier.allSecret<object>();
      const encryptor = new UserKeyEncryptor(encryptService, keyService, classifier, dataPacker);

      await expect(encryptor.decrypt({} as any, {} as any, null)).rejects.toThrow(
        "userId cannot be null or undefined",
      );
      await expect(encryptor.decrypt({} as any, {} as any, undefined)).rejects.toThrow(
        "userId cannot be null or undefined",
      );
    });

    it("should declassify a decrypted packed value using the user's key", async () => {
      const classifier = SecretClassifier.allSecret<object>();
      const classifierDeclassify = jest.spyOn(classifier, "declassify");
      const declassified = {} as any;
      classifierDeclassify.mockReturnValue(declassified);
      const encryptor = new UserKeyEncryptor(encryptService, keyService, classifier, dataPacker);
      const secret = "encrypted" as any;
      const disclosed = {} as any;

      const result = await encryptor.decrypt(secret, disclosed, anyUserId);

      expect(keyService.getUserKey).toHaveBeenCalledWith(anyUserId);
      expect(encryptService.decryptToUtf8).toHaveBeenCalledWith(secret, userKey);
      expect(dataPacker.unpack).toHaveBeenCalledWith(secret);
      expect(classifierDeclassify).toHaveBeenCalledWith(disclosed, secret);
      expect(result).toBe(declassified);
    });
  });
});
