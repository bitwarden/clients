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
      "throws error when downstreamKey parameter is %s",
      async (downstreamKey) => {
        const externalKey = createSymmetricKey();
        await expect(service.createKeySet(externalKey, downstreamKey as any)).rejects.toThrow(
          "failed to create key set: downstreamKey is required",
        );
      },
    );

    test.each([null, undefined])(
      "throws error when upstreamKey parameter is %s",
      async (upstreamKey) => {
        const userKey = createSymmetricKey();
        await expect(service.createKeySet(upstreamKey as any, userKey)).rejects.toThrow(
          "failed to create key set: upstreamKey is required",
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

      const result = await service.createKeySet(externalKey, userKey);

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
        oldDownstreamKey: createSymmetricKey(),
        newDownstreamKey: createSymmetricKey(),
        expectedError: "failed to rotate key set: keySet is required",
      },
      {
        keySet: undefined as any as RotateableKeySet,
        oldDownstreamKey: createSymmetricKey(),
        newDownstreamKey: createSymmetricKey(),
        expectedError: "failed to rotate key set: keySet is required",
      },
      {
        keySet: keySet,
        oldDownstreamKey: null,
        newDownstreamKey: createSymmetricKey(),
        expectedError: "failed to rotate key set: oldDownstreamKey is required",
      },
      {
        keySet: keySet,
        oldDownstreamKey: undefined,
        newDownstreamKey: createSymmetricKey(),
        expectedError: "failed to rotate key set: oldDownstreamKey is required",
      },
      {
        keySet: keySet,
        oldDownstreamKey: createSymmetricKey(),
        newDownstreamKey: null,
        expectedError: "failed to rotate key set: newDownstreamKey is required",
      },
      {
        keySet: keySet,
        oldDownstreamKey: createSymmetricKey(),
        newDownstreamKey: undefined,
        expectedError: "failed to rotate key set: newDownstreamKey is required",
      },
    ];

    test.each(dataValidationTests)(
      "should throw error when required parameter is missing",
      async ({ keySet, oldDownstreamKey, newDownstreamKey, expectedError }) => {
        await expect(
          service.rotateKeySet(keySet, oldDownstreamKey as any, newDownstreamKey as any),
        ).rejects.toThrow(expectedError);
      },
    );

    it("throws an error if the public key cannot be decrypted", async () => {
      const oldDownstreamKey = createSymmetricKey();
      const newDownstreamKey = createSymmetricKey();

      encryptService.unwrapEncapsulationKey.mockResolvedValue(null as any);

      await expect(
        service.rotateKeySet(keySet, oldDownstreamKey, newDownstreamKey),
      ).rejects.toThrow("failed to rotate key set: could not decrypt public key");

      expect(encryptService.unwrapEncapsulationKey).toHaveBeenCalledWith(
        keySet.encryptedPublicKey,
        oldDownstreamKey,
      );

      expect(encryptService.wrapEncapsulationKey).not.toHaveBeenCalled();
      expect(encryptService.encapsulateKeyUnsigned).not.toHaveBeenCalled();
    });

    it("rotates the key set", async () => {
      const oldDownstreamKey = createSymmetricKey();
      const newDownstreamKey = new SymmetricCryptoKey(new Uint8Array(64));
      const publicKey = Utils.fromB64ToArray("decryptedPublicKey");
      const newEncryptedPublicKey = new EncString("newEncPublicKey");
      const newEncryptedRotateableKey = new EncString("newEncUserKey");

      encryptService.unwrapEncapsulationKey.mockResolvedValue(publicKey);
      encryptService.wrapEncapsulationKey.mockResolvedValue(newEncryptedPublicKey);
      encryptService.encapsulateKeyUnsigned.mockResolvedValue(newEncryptedRotateableKey);

      const result = await service.rotateKeySet(keySet, oldDownstreamKey, newDownstreamKey);

      expect(result).toEqual(
        new RotateableKeySet(
          newEncryptedRotateableKey,
          newEncryptedPublicKey,
          keySet.encryptedPrivateKey,
        ),
      );
      expect(encryptService.unwrapEncapsulationKey).toHaveBeenCalledWith(
        keySet.encryptedPublicKey,
        oldDownstreamKey,
      );
      expect(encryptService.wrapEncapsulationKey).toHaveBeenCalledWith(publicKey, newDownstreamKey);
      expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(
        newDownstreamKey,
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
