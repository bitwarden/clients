import { mock } from "jest-mock-extended";
import { of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { KeyGenerationService } from "../../../key-management/crypto";
import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { Utils } from "../../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "../../../types/csprng";
import { UserKey } from "../../../types/key";
import { ReceiveCreateInput } from "../models/receive-create-input";

import { DefaultReceiveService } from "./default-receive.service";

describe("DefaultReceiveService", () => {
  const encryptService = mock<EncryptService>();
  const keyService = mock<KeyService>();
  const keyGenerationService = mock<KeyGenerationService>();

  const mockUserId = Utils.newGuid() as UserId;
  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;
  const mockScek = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray);
  const mockB64PublicKey = Utils.fromBufferToB64(new Uint8Array(32));
  const mockWrappedPrivateKey = { encryptedString: "mockWrappedPrivateKey" } as EncString;
  const mockScekWrappedPublicKey = { encryptedString: "mockScekWrappedPublicKey" } as EncString;
  const mockUserKeyWrappedScek = { encryptedString: "mockUserKeyWrappedScek" } as EncString;

  let sut: DefaultReceiveService;

  beforeEach(() => {
    jest.resetAllMocks();

    keyService.userKey$.mockReturnValue(of(mockUserKey));
    keyGenerationService.createKey.mockResolvedValue(mockScek);
    keyService.makeKeyPair.mockResolvedValue([mockB64PublicKey, mockWrappedPrivateKey]);
    encryptService.wrapEncapsulationKey.mockResolvedValue(mockScekWrappedPublicKey);
    encryptService.wrapSymmetricKey.mockResolvedValue(mockUserKeyWrappedScek);
    encryptService.encryptString.mockResolvedValue({
      encryptedString: "mockEncryptedName",
    } as EncString);

    sut = new DefaultReceiveService(encryptService, keyService, keyGenerationService);
  });

  describe("create", () => {
    it("generates all receive keys and encrypts the request payload", async () => {
      const mockInput: ReceiveCreateInput = {
        name: "Test Receive",
        expirationDate: new Date("2026-12-31"),
      };

      const result = await sut.create(mockInput, mockUserId);

      expect(keyService.userKey$).toHaveBeenCalledWith(mockUserId);
      expect(keyGenerationService.createKey).toHaveBeenCalledWith(512);
      expect(keyService.makeKeyPair).toHaveBeenCalledWith(mockUserKey);
      expect(encryptService.wrapEncapsulationKey).toHaveBeenCalledWith(
        Utils.fromB64ToArray(mockB64PublicKey),
        mockScek,
      );
      expect(encryptService.wrapSymmetricKey).toHaveBeenCalledWith(mockScek, mockUserKey);
      expect(encryptService.encryptString).toHaveBeenCalledWith(mockInput.name, mockScek);
      expect(result.id).toBeDefined();
    });
  });
});
