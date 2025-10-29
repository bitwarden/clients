import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { RotateableKeySet } from "@bitwarden/common/key-management/keys/models/rotateable-key-set";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { KeyService } from "@bitwarden/key-management";

import { RotateableKeySetService } from "./rotateable-key-set.service";

describe("RotateableKeySetService", () => {
  let testBed!: TestBed;
  let keyService!: MockProxy<KeyService>;
  let encryptService!: MockProxy<EncryptService>;
  let service!: RotateableKeySetService;

  beforeEach(() => {
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    testBed = TestBed.configureTestingModule({
      providers: [
        { provide: KeyService, useValue: keyService },
        { provide: EncryptService, useValue: encryptService },
      ],
    });
    service = testBed.inject(RotateableKeySetService);
  });

  describe("createKeySet", () => {
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
        keySet: null,
        oldRotateableKey: createSymmetricKey(),
        newRotateableKey: createSymmetricKey(),
        expectedError: "failed to rotate key set: keySet is required",
      },
      {
        keySet: undefined,
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
          service.rotateKeySet(keySet as any, oldRotateableKey as any, newRotateableKey as any),
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
