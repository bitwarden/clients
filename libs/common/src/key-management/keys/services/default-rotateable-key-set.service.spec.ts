import { mock, MockProxy } from "jest-mock-extended";

// eslint-disable-next-line no-restricted-imports
import {
  EncryptService,
  EncString,
  LegacyCompatKeyService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";

import { Utils } from "../../../platform/misc/utils";
import { RotateableKeySet } from "../models/rotateable-key-set";

import { DefaultRotateableKeySetService } from "./default-rotateable-key-set.service";

describe("DefaultRotateableKeySetService", () => {
  let legacyCompatKeyService!: MockProxy<LegacyCompatKeyService>;
  let encryptService!: MockProxy<EncryptService>;
  let service!: DefaultRotateableKeySetService;

  beforeEach(() => {
    legacyCompatKeyService = mock<LegacyCompatKeyService>();
    encryptService = mock<EncryptService>();
    service = new DefaultRotateableKeySetService(legacyCompatKeyService, encryptService);
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
      legacyCompatKeyService.makeKeyPair.mockResolvedValue(["publicKey", encryptedPrivateKey]);
      encryptService.encapsulateKeyUnsigned.mockResolvedValue(encryptedUserKey);
      encryptService.wrapEncapsulationKey.mockResolvedValue(encryptedPublicKey);

      const result = await service.createKeySet(externalKey, userKey);

      expect(result).toEqual(
        new RotateableKeySet(encryptedUserKey, encryptedPublicKey, encryptedPrivateKey),
      );
      expect(legacyCompatKeyService.makeKeyPair).toHaveBeenCalledWith(externalKey);
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
});

function createSymmetricKey() {
  const key = Utils.fromB64ToArray(
    "1h-TuPwSbX5qoX0aVgjmda_Lfq85qAcKssBlXZnPIsQC3HNDGIecunYqXhJnp55QpdXRh-egJiLH3a0wqlVQsQ",
  );
  return new SymmetricCryptoKey(key);
}
