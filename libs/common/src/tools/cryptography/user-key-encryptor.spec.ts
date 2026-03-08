import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { makeEncString } from "../../../spec";
import { EncString } from "../../key-management/crypto/models/enc-string";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../types/guid";
import { DataPacker } from "../state/data-packer.abstraction";

import { UserKeyEncryptor } from "./user-key-encryptor";

describe("UserKeyEncryptor", () => {
  const sdkService = mock<SdkService>();
  const dataPacker = mock<DataPacker>();
  const anyUserId = "foo" as UserId;

  const mockCrypto = {
    encrypt_with_local_user_data_key: jest.fn(),
    decrypt_with_local_user_data_key: jest.fn(),
  };
  const mockSdkClient = {
    take: () => ({
      value: { crypto: () => mockCrypto },
      [Symbol.dispose]: jest.fn(),
    }),
  };

  beforeEach(() => {
    mockCrypto.encrypt_with_local_user_data_key.mockImplementation((p: string) => `encrypted:${p}`);
    mockCrypto.decrypt_with_local_user_data_key.mockImplementation((c: string) => `decrypted:${c}`);
    sdkService.userClient$.mockReturnValue(new BehaviorSubject(mockSdkClient as any));
    dataPacker.pack.mockImplementation((v) => v as string);
    dataPacker.unpack.mockImplementation(<T>(v: string) => v as T);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("constructor", () => {
    it("should set userId", async () => {
      const encryptor = new UserKeyEncryptor(anyUserId, sdkService, dataPacker);
      expect(encryptor.userId).toEqual(anyUserId);
    });

    it("should throw if userId was not supplied", async () => {
      expect(() => new UserKeyEncryptor(null as unknown as UserId, sdkService, dataPacker)).toThrow(
        "userId cannot be null or undefined",
      );
      expect(
        () => new UserKeyEncryptor(undefined as unknown as UserId, sdkService, dataPacker),
      ).toThrow("userId cannot be null or undefined");
    });

    it("should throw if sdkService was not supplied", async () => {
      expect(
        () => new UserKeyEncryptor(anyUserId, null as unknown as SdkService, dataPacker),
      ).toThrow("sdkService cannot be null or undefined");
      expect(
        () => new UserKeyEncryptor(anyUserId, undefined as unknown as SdkService, dataPacker),
      ).toThrow("sdkService cannot be null or undefined");
    });

    it("should throw if dataPacker was not supplied", async () => {
      expect(
        () => new UserKeyEncryptor(anyUserId, sdkService, null as unknown as DataPacker),
      ).toThrow("dataPacker cannot be null or undefined");
      expect(
        () => new UserKeyEncryptor(anyUserId, sdkService, undefined as unknown as DataPacker),
      ).toThrow("dataPacker cannot be null or undefined");
    });
  });

  describe("encrypt", () => {
    it("should throw if value was not supplied", async () => {
      const encryptor = new UserKeyEncryptor(anyUserId, sdkService, dataPacker);

      await expect(encryptor.encrypt<Record<string, never>>(null as never)).rejects.toThrow(
        "secret cannot be null or undefined",
      );
      await expect(encryptor.encrypt<Record<string, never>>(undefined as never)).rejects.toThrow(
        "secret cannot be null or undefined",
      );
    });

    it("should encrypt a packed value using the SDK", async () => {
      const encryptor = new UserKeyEncryptor(anyUserId, sdkService, dataPacker);
      const value = { foo: true };
      const expectedEncString = makeEncString();
      mockCrypto.encrypt_with_local_user_data_key.mockReturnValue(
        expectedEncString.encryptedString,
      );

      const result = await encryptor.encrypt(value);

      expect(dataPacker.pack).toHaveBeenCalledWith(value);
      expect(mockCrypto.encrypt_with_local_user_data_key).toHaveBeenCalledWith(value);
      expect(result).toEqual(expectedEncString);
    });
  });

  describe("decrypt", () => {
    it("should throw if secret was not supplied", async () => {
      const encryptor = new UserKeyEncryptor(anyUserId, sdkService, dataPacker);

      await expect(encryptor.decrypt(null as unknown as EncString)).rejects.toThrow(
        "secret cannot be null or undefined",
      );
      await expect(encryptor.decrypt(undefined as unknown as EncString)).rejects.toThrow(
        "secret cannot be null or undefined",
      );
    });

    it("should decrypt a packed value using the SDK", async () => {
      const encryptor = new UserKeyEncryptor(anyUserId, sdkService, dataPacker);
      const secret = makeEncString();
      mockCrypto.decrypt_with_local_user_data_key.mockReturnValue("decrypted:some-encrypted-value");

      const result = await encryptor.decrypt(secret);

      expect(mockCrypto.decrypt_with_local_user_data_key).toHaveBeenCalledWith(
        secret.encryptedString,
      );
      expect(dataPacker.unpack).toHaveBeenCalledWith("decrypted:some-encrypted-value");
      expect(result).toBe("decrypted:some-encrypted-value");
    });
  });
});
