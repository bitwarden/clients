// eslint-disable-next-line no-restricted-imports
import { Substitute, Arg } from "@fluffy-spoon/substitute";
import { mock, MockProxy } from "jest-mock-extended";

import { EncryptionType } from "../../../enums";
import { EncryptService } from "../../../platform/abstractions/encrypt.service";
import {
  OrgKey,
  SymmetricCryptoKey,
  UserKey,
} from "../../../platform/models/domain/symmetric-crypto-key";
import { CryptoService } from "../../abstractions/crypto.service";
import { ContainerService } from "../../services/container.service";

import { EncString } from "./enc-string";

describe("EncString", () => {
  afterEach(() => {
    (window as any).bitwardenContainerService = undefined;
  });

  describe("Rsa2048_OaepSha256_B64", () => {
    it("constructor", () => {
      const encString = new EncString(EncryptionType.Rsa2048_OaepSha256_B64, "data");

      expect(encString).toEqual({
        data: "data",
        encryptedString: "3.data",
        encryptionType: 3,
      });
    });

    describe("isSerializedEncString", () => {
      it("is true if valid", () => {
        expect(EncString.isSerializedEncString("3.data")).toBe(true);
      });

      it("is false if invalid", () => {
        expect(EncString.isSerializedEncString("3.data|test")).toBe(false);
      });
    });

    describe("parse existing", () => {
      it("valid", () => {
        const encString = new EncString("3.data");

        expect(encString).toEqual({
          data: "data",
          encryptedString: "3.data",
          encryptionType: 3,
        });
      });

      it("invalid", () => {
        const encString = new EncString("3.data|test");

        expect(encString).toEqual({
          encryptedString: "3.data|test",
          encryptionType: 3,
        });
      });
    });

    describe("decrypt", () => {
      const encString = new EncString(EncryptionType.Rsa2048_OaepSha256_B64, "data");

      const cryptoService = Substitute.for<CryptoService>();
      cryptoService.getOrgKey(null).resolves(null);

      const encryptService = Substitute.for<EncryptService>();
      encryptService.decryptToUtf8(encString, Arg.any()).resolves("decrypted");

      beforeEach(() => {
        (window as any).bitwardenContainerService = new ContainerService(
          cryptoService,
          encryptService
        );
      });

      it("decrypts correctly", async () => {
        const decrypted = await encString.decrypt(null);

        expect(decrypted).toBe("decrypted");
      });

      it("result should be cached", async () => {
        const decrypted = await encString.decrypt(null);
        encryptService.received(1).decryptToUtf8(Arg.any(), Arg.any());

        expect(decrypted).toBe("decrypted");
      });
    });
  });

  describe("AesCbc256_B64", () => {
    it("constructor", () => {
      const encString = new EncString(EncryptionType.AesCbc256_B64, "data", "iv");

      expect(encString).toEqual({
        data: "data",
        encryptedString: "0.iv|data",
        encryptionType: 0,
        iv: "iv",
      });
    });

    describe("isSerializedEncString", () => {
      it("is true if valid", () => {
        expect(EncString.isSerializedEncString("0.iv|data")).toBe(true);
      });

      it("is false if invalid", () => {
        expect(EncString.isSerializedEncString("0.iv|data|mac")).toBe(false);
      });
    });

    describe("parse existing", () => {
      it("valid", () => {
        const encString = new EncString("0.iv|data");

        expect(encString).toEqual({
          data: "data",
          encryptedString: "0.iv|data",
          encryptionType: 0,
          iv: "iv",
        });
      });

      it("invalid", () => {
        const encString = new EncString("0.iv|data|mac");

        expect(encString).toEqual({
          encryptedString: "0.iv|data|mac",
          encryptionType: 0,
        });
      });
    });
  });

  describe("AesCbc256_HmacSha256_B64", () => {
    it("constructor", () => {
      const encString = new EncString(EncryptionType.AesCbc256_HmacSha256_B64, "data", "iv", "mac");

      expect(encString).toEqual({
        data: "data",
        encryptedString: "2.iv|data|mac",
        encryptionType: 2,
        iv: "iv",
        mac: "mac",
      });
    });

    describe("isSerializedEncString", () => {
      it("is true if valid", () => {
        expect(EncString.isSerializedEncString("2.iv|data|mac")).toBe(true);
      });

      it("is false if invalid", () => {
        expect(EncString.isSerializedEncString("2.iv|data")).toBe(false);
      });
    });

    it("valid", () => {
      const encString = new EncString("2.iv|data|mac");

      expect(encString).toEqual({
        data: "data",
        encryptedString: "2.iv|data|mac",
        encryptionType: 2,
        iv: "iv",
        mac: "mac",
      });
    });

    it("invalid", () => {
      const encString = new EncString("2.iv|data");

      expect(encString).toEqual({
        encryptedString: "2.iv|data",
        encryptionType: 2,
      });
    });
  });

  it("Exit early if null", () => {
    const encString = new EncString(null);

    expect(encString).toEqual({
      encryptedString: null,
    });
  });

  describe("decrypt", () => {
    let cryptoService: MockProxy<CryptoService>;
    let encryptService: MockProxy<EncryptService>;
    let encString: EncString;

    beforeEach(() => {
      cryptoService = mock<CryptoService>();
      encryptService = mock<EncryptService>();
      encString = new EncString(null);

      (window as any).bitwardenContainerService = new ContainerService(
        cryptoService,
        encryptService
      );
    });

    it("handles value it can't decrypt", async () => {
      encryptService.decryptToUtf8.mockRejectedValue("error");

      (window as any).bitwardenContainerService = new ContainerService(
        cryptoService,
        encryptService
      );

      const decrypted = await encString.decrypt(null);

      expect(decrypted).toBe("[error: cannot decrypt]");

      expect(encString).toEqual({
        decryptedValue: "[error: cannot decrypt]",
        encryptedString: null,
      });
    });

    it("uses provided key without depending on CryptoService", async () => {
      const key = mock<SymmetricCryptoKey>();

      await encString.decrypt(null, key);

      expect(cryptoService.getUserKeyWithLegacySupport).not.toHaveBeenCalled();
      expect(encryptService.decryptToUtf8).toHaveBeenCalledWith(encString, key);
    });

    it("gets an organization key if required", async () => {
      const orgKey = mock<OrgKey>();

      cryptoService.getOrgKey.calledWith("orgId").mockResolvedValue(orgKey);

      await encString.decrypt("orgId", null);

      expect(cryptoService.getOrgKey).toHaveBeenCalledWith("orgId");
      expect(encryptService.decryptToUtf8).toHaveBeenCalledWith(encString, orgKey);
    });

    it("gets the user's decryption key if required", async () => {
      const userKey = mock<UserKey>();

      cryptoService.getUserKeyWithLegacySupport.mockResolvedValue(userKey);

      await encString.decrypt(null, null);

      expect(cryptoService.getUserKeyWithLegacySupport).toHaveBeenCalledWith();
      expect(encryptService.decryptToUtf8).toHaveBeenCalledWith(encString, userKey);
    });
  });

  describe("toJSON", () => {
    it("Should be represented by the encrypted string", () => {
      const encString = new EncString(EncryptionType.AesCbc256_B64, "data", "iv");

      expect(encString.toJSON()).toBe(encString.encryptedString);
    });

    it("returns null if object is null", () => {
      expect(EncString.fromJSON(null)).toBeNull();
    });
  });
});
