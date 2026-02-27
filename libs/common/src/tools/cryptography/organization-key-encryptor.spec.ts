import { mock } from "jest-mock-extended";

import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "../../types/csprng";
import { OrganizationId } from "../../types/guid";
import { OrgKey } from "../../types/key";
import { DataPacker } from "../state/data-packer.abstraction";

import { OrganizationKeyEncryptor } from "./organization-key-encryptor";

describe("OrgKeyEncryptor", () => {
  const encryptService = mock<EncryptService>();
  const dataPacker = mock<DataPacker>();
  const orgKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as OrgKey;
  const anyOrgId = "foo" as OrganizationId;

  beforeEach(() => {
    // The OrgKeyEncryptor is, in large part, a facade coordinating a handful of worker
    // objects, so its tests focus on how data flows between components. The defaults rely
    // on this property--that the facade treats its data like a opaque objects--to trace
    // the data through several function calls. Should the encryptor interact with the
    // objects themselves, these mocks will break.
    encryptService.encryptString.mockImplementation((p) =>
      Promise.resolve(p as unknown as EncString),
    );
    encryptService.decryptString.mockImplementation((c) => Promise.resolve(c as unknown as string));
    dataPacker.pack.mockImplementation((v) => v as string);
    dataPacker.unpack.mockImplementation(<T>(v: string) => v as T);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("constructor", () => {
    it("should set organizationId", async () => {
      const encryptor = new OrganizationKeyEncryptor(anyOrgId, encryptService, orgKey, dataPacker);
      expect(encryptor.organizationId).toEqual(anyOrgId);
    });

    it("should throw if organizationId was not supplied", async () => {
      expect(() => new OrganizationKeyEncryptor(null, encryptService, orgKey, dataPacker)).toThrow(
        "organizationId cannot be null or undefined",
      );
      expect(() => new OrganizationKeyEncryptor(null, encryptService, orgKey, dataPacker)).toThrow(
        "organizationId cannot be null or undefined",
      );
    });

    it("should throw if encryptService was not supplied", async () => {
      expect(() => new OrganizationKeyEncryptor(anyOrgId, null, orgKey, dataPacker)).toThrow(
        "encryptService cannot be null or undefined",
      );
      expect(() => new OrganizationKeyEncryptor(anyOrgId, null, orgKey, dataPacker)).toThrow(
        "encryptService cannot be null or undefined",
      );
    });

    it("should throw if key was not supplied", async () => {
      expect(
        () => new OrganizationKeyEncryptor(anyOrgId, encryptService, null, dataPacker),
      ).toThrow("key cannot be null or undefined");
      expect(
        () => new OrganizationKeyEncryptor(anyOrgId, encryptService, null, dataPacker),
      ).toThrow("key cannot be null or undefined");
    });

    it("should throw if dataPacker was not supplied", async () => {
      expect(() => new OrganizationKeyEncryptor(anyOrgId, encryptService, orgKey, null)).toThrow(
        "dataPacker cannot be null or undefined",
      );
      expect(() => new OrganizationKeyEncryptor(anyOrgId, encryptService, orgKey, null)).toThrow(
        "dataPacker cannot be null or undefined",
      );
    });
  });

  describe("encrypt", () => {
    it("should throw if value was not supplied", async () => {
      const encryptor = new OrganizationKeyEncryptor(anyOrgId, encryptService, orgKey, dataPacker);

      await expect(encryptor.encrypt<Record<string, never>>(null)).rejects.toThrow(
        "secret cannot be null or undefined",
      );
      await expect(encryptor.encrypt<Record<string, never>>(undefined)).rejects.toThrow(
        "secret cannot be null or undefined",
      );
    });

    it("should encrypt a packed value using the organization's key", async () => {
      const encryptor = new OrganizationKeyEncryptor(anyOrgId, encryptService, orgKey, dataPacker);
      const value = { foo: true };

      const result = await encryptor.encrypt(value);

      // these are data flow expectations; the operations all all pass-through mocks
      expect(dataPacker.pack).toHaveBeenCalledWith(value);
      expect(encryptService.encryptString).toHaveBeenCalledWith(value, orgKey);
      expect(result).toBe(value);
    });
  });

  describe("decrypt", () => {
    it("should throw if secret was not supplied", async () => {
      const encryptor = new OrganizationKeyEncryptor(anyOrgId, encryptService, orgKey, dataPacker);

      await expect(encryptor.decrypt(null)).rejects.toThrow("secret cannot be null or undefined");
      await expect(encryptor.decrypt(undefined)).rejects.toThrow(
        "secret cannot be null or undefined",
      );
    });

    it("should declassify a decrypted packed value using the organization's key", async () => {
      const encryptor = new OrganizationKeyEncryptor(anyOrgId, encryptService, orgKey, dataPacker);
      const secret = "encrypted" as any;

      const result = await encryptor.decrypt(secret);

      // these are data flow expectations; the operations all all pass-through mocks
      expect(encryptService.decryptString).toHaveBeenCalledWith(secret, orgKey);
      expect(dataPacker.unpack).toHaveBeenCalledWith(secret);
      expect(result).toBe(secret);
    });
  });
});
