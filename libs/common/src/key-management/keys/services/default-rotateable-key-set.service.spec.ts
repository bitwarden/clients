import { mock, MockProxy } from "jest-mock-extended";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import { Utils } from "../../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { EncryptService } from "../../crypto/abstractions/encrypt.service";
import { EncString } from "../../crypto/models/enc-string";
import { RotateableKeySet } from "../models/rotateable-key-set";

import { DefaultRotateableKeySetService } from "./default-rotateable-key-set.service";

describe("DefaultRotateableKeySetService", () => {
  let keyService!: MockProxy<KeyService>;
  let encryptService!: MockProxy<EncryptService>;
  let service!: DefaultRotateableKeySetService;

  beforeEach(() => {
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    service = new DefaultRotateableKeySetService(keyService, encryptService);
  });

  describe("createKeySet", () => {
    test.each([null, undefined])(
      "throws error when rotateableKey parameter is %s",
      async (rotateableKey) => {
        const externalKey = createSymmetricKey();
        await expect(service.createKeySet(rotateableKey as any, externalKey)).rejects.toThrow(
          "failed to create key set: rotateableKey is required",
        );
      },
    );

    test.each([null, undefined])(
      "throws error when externalKey parameter is %s",
      async (externalKey) => {
        const userKey = createSymmetricKey();
        await expect(service.createKeySet(userKey, externalKey as any)).rejects.toThrow(
          "failed to create key set: externalKey is required",
        );
      },
    );

    it("should create a new key set", async () => {
      const externalKey = createSymmetricKey();
      const userKey = createSymmetricKey();
      const encryptedUserKey = new EncString("encryptedUserKey");
      const encryptedPublicKey = new EncString("encryptedPublicKey");
      const encryptedPrivateKey = new EncString("encryptedPrivateKey");
      keyService.makeKeyPair.mockResolvedValue(["publicKey", encryptedPrivateKey]);
      encryptService.encapsulateKeyUnsigned.mockResolvedValue(encryptedUserKey);
      encryptService.wrapEncapsulationKey.mockResolvedValue(encryptedPublicKey);

      const result = await service.createKeySet(userKey, externalKey);

      expect(result).toEqual(
        new RotateableKeySet(encryptedUserKey, encryptedPublicKey, encryptedPrivateKey),
      );
      expect(keyService.makeKeyPair).toHaveBeenCalledWith(externalKey);
      expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(
        userKey,
        Utils.fromB64ToArray("publicKey"),
      );
      expect(encryptService.wrapEncapsulationKey).toHaveBeenCalledWith(
        Utils.fromB64ToArray("publicKey"),
        userKey,
      );
    });
  });

  describe("rotateKeySet", () => {
    const keySet = new RotateableKeySet(
      new EncString("encUserKey"),
      new EncString("encPublicKey"),
      new EncString("encPrivateKey"),
    );
    const dataValidationTests = [
      {
        keySet: null as any as RotateableKeySet,
        oldRotateableKey: createSymmetricKey(),
        newRotateableKey: createSymmetricKey(),
        expectedError: "failed to rotate key set: keySet is required",
      },
      {
        keySet: undefined as any as RotateableKeySet,
        oldRotateableKey: createSymmetricKey(),
        newRotateableKey: createSymmetricKey(),
        expectedError: "failed to rotate key set: keySet is required",
      },
      {
        keySet: keySet,
        oldRotateableKey: null,
        newRotateableKey: createSymmetricKey(),
        expectedError: "failed to rotate key set: oldRotateableKey is required",
      },
      {
        keySet: keySet,
        oldRotateableKey: undefined,
        newRotateableKey: createSymmetricKey(),
        expectedError: "failed to rotate key set: oldRotateableKey is required",
      },
      {
        keySet: keySet,
        oldRotateableKey: createSymmetricKey(),
        newRotateableKey: null,
        expectedError: "failed to rotate key set: newRotateableKey is required",
      },
      {
        keySet: keySet,
        oldRotateableKey: createSymmetricKey(),
        newRotateableKey: undefined,
        expectedError: "failed to rotate key set: newRotateableKey is required",
      },
    ];

    test.each(dataValidationTests)(
      "should throw error when required parameter is missing",
      async ({ keySet, oldRotateableKey, newRotateableKey, expectedError }) => {
        await expect(
          service.rotateKeySet(keySet, oldRotateableKey as any, newRotateableKey as any),
        ).rejects.toThrow(expectedError);
      },
    );

    it("throws an error if the public key cannot be decrypted", async () => {
      const oldRotateableKey = createSymmetricKey();
      const newRotateableKey = createSymmetricKey();

      encryptService.unwrapEncapsulationKey.mockResolvedValue(null as any);

      await expect(
        service.rotateKeySet(keySet, oldRotateableKey, newRotateableKey),
      ).rejects.toThrow("failed to rotate key set: could not decrypt public key");

      expect(encryptService.unwrapEncapsulationKey).toHaveBeenCalledWith(
        keySet.encryptedPublicKey,
        oldRotateableKey,
      );

      expect(encryptService.wrapEncapsulationKey).not.toHaveBeenCalled();
      expect(encryptService.encapsulateKeyUnsigned).not.toHaveBeenCalled();
    });

    it("rotates the key set", async () => {
      const oldRotateableKey = createSymmetricKey();
      const newRotateableKey = new SymmetricCryptoKey(new Uint8Array(64));
      const publicKey = Utils.fromB64ToArray("decryptedPublicKey");
      const newEncryptedPublicKey = new EncString("newEncPublicKey");
      const newEncryptedRotateableKey = new EncString("newEncUserKey");

      encryptService.unwrapEncapsulationKey.mockResolvedValue(publicKey);
      encryptService.wrapEncapsulationKey.mockResolvedValue(newEncryptedPublicKey);
      encryptService.encapsulateKeyUnsigned.mockResolvedValue(newEncryptedRotateableKey);

      const result = await service.rotateKeySet(keySet, oldRotateableKey, newRotateableKey);

      expect(result).toEqual(
        new RotateableKeySet(
          newEncryptedRotateableKey,
          newEncryptedPublicKey,
          keySet.encryptedPrivateKey,
        ),
      );
      expect(encryptService.unwrapEncapsulationKey).toHaveBeenCalledWith(
        keySet.encryptedPublicKey,
        oldRotateableKey,
      );
      expect(encryptService.wrapEncapsulationKey).toHaveBeenCalledWith(publicKey, newRotateableKey);
      expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(
        newRotateableKey,
        publicKey,
      );
    });
  });
});

function createSymmetricKey() {
  const key = Utils.fromB64ToArray(
    "1h-TuPwSbX5qoX0aVgjmda_Lfq85qAcKssBlXZnPIsQC3HNDGIecunYqXhJnp55QpdXRh-egJiLH3a0wqlVQsQ",
  );
  return new SymmetricCryptoKey(key);
}
