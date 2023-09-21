import { makeStaticByteArray } from "../../../../spec";
import { CsprngArray } from "../../../types/csprng";
import { Utils } from "../../misc/utils";

import { AccountKeys, EncryptionPair } from "./account";
import { DeviceKey, SymmetricCryptoKey } from "./symmetric-crypto-key";

describe("AccountKeys", () => {
  describe("toJSON", () => {
    it("should serialize itself", () => {
      const keys = new AccountKeys();
      const buffer = makeStaticByteArray(64);
      keys.publicKey = buffer;

      const bufferSpy = jest.spyOn(Utils, "fromBufferToByteString");
      keys.toJSON();
      expect(bufferSpy).toHaveBeenCalledWith(buffer);
    });

    it("should serialize public key as a string", () => {
      const keys = new AccountKeys();
      keys.publicKey = Utils.fromByteStringToArray("hello");
      const json = JSON.stringify(keys);
      expect(json).toContain('"publicKey":"hello"');
    });

    // As the accountKeys.toJSON doesn't really serialize the device key
    // this method just checks the persistence of the deviceKey
    it("should persist deviceKey", () => {
      // Arrange
      const accountKeys = new AccountKeys();
      const deviceKeyBytesLength = 64;
      accountKeys.deviceKey = new SymmetricCryptoKey(
        new Uint8Array(deviceKeyBytesLength).buffer as CsprngArray
      ) as DeviceKey;

      // Act
      const serializedKeys = accountKeys.toJSON();

      // Assert
      expect(serializedKeys.deviceKey).toEqual(accountKeys.deviceKey);
    });
  });

  describe("fromJSON", () => {
    it("should deserialize public key to a buffer", () => {
      const keys = AccountKeys.fromJSON({
        publicKey: "hello",
      });
      expect(keys.publicKey).toEqual(Utils.fromByteStringToArray("hello"));
    });

    it("should deserialize cryptoMasterKey", () => {
      const spy = jest.spyOn(SymmetricCryptoKey, "fromJSON");
      AccountKeys.fromJSON({} as any);
      expect(spy).toHaveBeenCalled();
    });

    it("should deserialize organizationKeys", () => {
      const spy = jest.spyOn(SymmetricCryptoKey, "fromJSON");
      AccountKeys.fromJSON({ organizationKeys: [{ orgId: "keyJSON" }] } as any);
      expect(spy).toHaveBeenCalled();
    });

    it("should deserialize providerKeys", () => {
      const spy = jest.spyOn(SymmetricCryptoKey, "fromJSON");
      AccountKeys.fromJSON({ providerKeys: [{ providerId: "keyJSON" }] } as any);
      expect(spy).toHaveBeenCalled();
    });

    it("should deserialize privateKey", () => {
      const spy = jest.spyOn(EncryptionPair, "fromJSON");
      AccountKeys.fromJSON({
        privateKey: { encrypted: "encrypted", decrypted: "decrypted" },
      } as any);
      expect(spy).toHaveBeenCalled();
    });

    it("should deserialize deviceKey", () => {
      // Arrange
      const expectedKeyB64 =
        "ZJNnhx9BbJeb2EAq1hlMjqt6GFsg9G/GzoFf6SbPKsaiMhKGDcbHcwcyEg56Lh8lfilpZz4SRM6UA7oFCg+lSg==";

      const symmetricCryptoKeyFromJsonSpy = jest.spyOn(SymmetricCryptoKey, "fromJSON");

      // Act
      const accountKeys = AccountKeys.fromJSON({
        deviceKey: {
          keyB64: expectedKeyB64,
        },
      } as any);

      // Assert
      expect(symmetricCryptoKeyFromJsonSpy).toHaveBeenCalled();
      expect(accountKeys.deviceKey.keyB64).toEqual(expectedKeyB64);
    });
  });
});
