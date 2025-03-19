import { mock } from "jest-mock-extended";

import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "../../types/csprng";
import { UserId } from "../../types/guid";
import { UserKey } from "../../types/key";
import { DataPacker } from "../state/data-packer.abstraction";

import { UserKeyEncryptor } from "./user-key-encryptor";

describe("UserKeyEncryptor", () => {
  const encryptService = mock<EncryptService>();
  const dataPacker = mock<DataPacker>();
  const userKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;
  const anyUserId = "foo" as UserId;

  beforeEach(() => {
    // The UserKeyEncryptor is, in large part, a facade coordinating a handful of worker
    // objects, so its tests focus on how data flows between components. The defaults rely
    // on this property--that the facade treats its data like a opaque objects--to trace
    // the data through several function calls. Should the encryptor interact with the
    // objects themselves, these mocks will break.
    encryptService.encrypt.mockImplementation((p) => Promise.resolve(p as unknown as EncString));
    encryptService.decryptToUtf8.mockImplementation((c) => Promise.resolve(c as unknown as string));
    dataPacker.pack.mockImplementation((v) => v as string);
    dataPacker.unpack.mockImplementation(<T>(v: string) => v as T);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("constructor", () => {
    it("should set userId", async () => {
      const encryptor = new UserKeyEncryptor(anyUserId, encryptService, userKey, dataPacker);
      expect(encryptor.userId).toEqual(anyUserId);
    });

    it("should throw if userId was not supplied", async () => {
      expect(() => new UserKeyEncryptor(null, encryptService, userKey, dataPacker)).toThrow(
        "userId cannot be null or undefined",
      );
      expect(() => new UserKeyEncryptor(null, encryptService, userKey, dataPacker)).toThrow(
        "userId cannot be null or undefined",
      );
    });

    it("should throw if encryptService was not supplied", async () => {
      expect(() => new UserKeyEncryptor(anyUserId, null, userKey, dataPacker)).toThrow(
        "encryptService cannot be null or undefined",
      );
      expect(() => new UserKeyEncryptor(anyUserId, null, userKey, dataPacker)).toThrow(
        "encryptService cannot be null or undefined",
      );
    });

    it("should throw if key was not supplied", async () => {
      expect(() => new UserKeyEncryptor(anyUserId, encryptService, null, dataPacker)).toThrow(
        "key cannot be null or undefined",
      );
      expect(() => new UserKeyEncryptor(anyUserId, encryptService, null, dataPacker)).toThrow(
        "key cannot be null or undefined",
      );
    });

    it("should throw if dataPacker was not supplied", async () => {
      expect(() => new UserKeyEncryptor(anyUserId, encryptService, userKey, null)).toThrow(
        "dataPacker cannot be null or undefined",
      );
      expect(() => new UserKeyEncryptor(anyUserId, encryptService, userKey, null)).toThrow(
        "dataPacker cannot be null or undefined",
      );
    });
  });

  describe("encrypt", () => {
    it("should throw if value was not supplied", async () => {
      const encryptor = new UserKeyEncryptor(anyUserId, encryptService, userKey, dataPacker);

      await expect(encryptor.encrypt<Record<string, never>>(null)).rejects.toThrow(
        "secret cannot be null or undefined",
      );
      await expect(encryptor.encrypt<Record<string, never>>(undefined)).rejects.toThrow(
        "secret cannot be null or undefined",
      );
    });

    it("should encrypt a packed value using the user's key", async () => {
      const encryptor = new UserKeyEncryptor(anyUserId, encryptService, userKey, dataPacker);
      const value = { foo: true };

      const result = await encryptor.encrypt(value);

      // these are data flow expectations; the operations all all pass-through mocks
      expect(dataPacker.pack).toHaveBeenCalledWith(value);
      expect(encryptService.encrypt).toHaveBeenCalledWith(value, userKey);
      expect(result).toBe(value);
    });
  });

  describe("decrypt", () => {
    it("should throw if secret was not supplied", async () => {
      const encryptor = new UserKeyEncryptor(anyUserId, encryptService, userKey, dataPacker);

      await expect(encryptor.decrypt(null)).rejects.toThrow("secret cannot be null or undefined");
      await expect(encryptor.decrypt(undefined)).rejects.toThrow(
        "secret cannot be null or undefined",
      );
    });

    it("should declassify a decrypted packed value using the user's key", async () => {
      const encryptor = new UserKeyEncryptor(anyUserId, encryptService, userKey, dataPacker);
      const secret = "encrypted" as any;

      const result = await encryptor.decrypt(secret);

      // these are data flow expectations; the operations all all pass-through mocks
      expect(encryptService.decryptToUtf8).toHaveBeenCalledWith(secret, userKey);
      expect(dataPacker.unpack).toHaveBeenCalledWith(secret);
      expect(result).toBe(secret);
    });
  });
});
