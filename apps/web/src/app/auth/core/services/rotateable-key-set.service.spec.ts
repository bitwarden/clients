import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
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
      const encryptedUserKey = Symbol();
      const encryptedPublicKey = Symbol();
      const encryptedPrivateKey = Symbol();
      keyService.makeKeyPair.mockResolvedValue(["publicKey", encryptedPrivateKey as any]);
      keyService.getUserKey.mockResolvedValue({ key: userKey.key } as any);
      encryptService.rsaEncrypt.mockResolvedValue(encryptedUserKey as any);
      encryptService.encrypt.mockResolvedValue(encryptedPublicKey as any);

      const result = await service.createKeySet(externalKey as any);

      expect(result).toEqual({
        encryptedUserKey,
        encryptedPublicKey,
        encryptedPrivateKey,
      });
    });
  });
});

function createSymmetricKey() {
  const key = Utils.fromB64ToArray(
    "1h-TuPwSbX5qoX0aVgjmda_Lfq85qAcKssBlXZnPIsQC3HNDGIecunYqXhJnp55QpdXRh-egJiLH3a0wqlVQsQ",
  );
  return new SymmetricCryptoKey(key);
}
