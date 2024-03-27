import { mock } from "jest-mock-extended";

import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { EncryptService } from "../../../platform/abstractions/encrypt.service";
import { EncString } from "../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "../../../types/csprng";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";

import { DataPacker } from "./data-packer.abstraction";
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
      const encryptor = new UserKeyEncryptor(encryptService, keyService, dataPacker);

      await expect(encryptor.encrypt(null, anyUserId)).rejects.toThrow(
        "secret cannot be null or undefined",
      );
      await expect(encryptor.encrypt(undefined, anyUserId)).rejects.toThrow(
        "secret cannot be null or undefined",
      );
    });

    it("should throw if userId was not supplied", async () => {
      const encryptor = new UserKeyEncryptor(encryptService, keyService, dataPacker);

      await expect(encryptor.encrypt({} as any, null)).rejects.toThrow(
        "userId cannot be null or undefined",
      );
      await expect(encryptor.encrypt({} as any, undefined)).rejects.toThrow(
        "userId cannot be null or undefined",
      );
    });

    it("should encrypt a packed value using the user's key", async () => {
      const encryptor = new UserKeyEncryptor(encryptService, keyService, dataPacker);
      const value = { foo: true };

      const result = await encryptor.encrypt(value, anyUserId);

      // these are data flow expectations; the operations all all pass-through mocks
      expect(keyService.getUserKey).toHaveBeenCalledWith(anyUserId);
      expect(dataPacker.pack).toHaveBeenCalledWith(value);
      expect(encryptService.encrypt).toHaveBeenCalledWith(value, userKey);
      expect(result).toBe(value);
    });
  });

  describe("decrypt", () => {
    it("should throw if secret was not supplied", async () => {
      const encryptor = new UserKeyEncryptor(encryptService, keyService, dataPacker);

      await expect(encryptor.decrypt(null, anyUserId)).rejects.toThrow(
        "secret cannot be null or undefined",
      );
      await expect(encryptor.decrypt(undefined, anyUserId)).rejects.toThrow(
        "secret cannot be null or undefined",
      );
    });

    it("should throw if userId was not supplied", async () => {
      const encryptor = new UserKeyEncryptor(encryptService, keyService, dataPacker);

      await expect(encryptor.decrypt({} as any, null)).rejects.toThrow(
        "userId cannot be null or undefined",
      );
      await expect(encryptor.decrypt({} as any, undefined)).rejects.toThrow(
        "userId cannot be null or undefined",
      );
    });

    it("should declassify a decrypted packed value using the user's key", async () => {
      const encryptor = new UserKeyEncryptor(encryptService, keyService, dataPacker);
      const secret = "encrypted" as any;

      const result = await encryptor.decrypt(secret, anyUserId);

      // these are data flow expectations; the operations all all pass-through mocks
      expect(keyService.getUserKey).toHaveBeenCalledWith(anyUserId);
      expect(encryptService.decryptToUtf8).toHaveBeenCalledWith(secret, userKey);
      expect(dataPacker.unpack).toHaveBeenCalledWith(secret);
      expect(result).toBe(secret);
    });
  });
});
