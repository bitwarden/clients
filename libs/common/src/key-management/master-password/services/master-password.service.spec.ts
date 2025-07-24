import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";
import * as rxjs from "rxjs";

import { makeSymmetricCryptoKey } from "../../../../spec";
import { ForceSetPasswordReason } from "../../../auth/models/domain/force-set-password-reason";
import { KeyGenerationService } from "../../../platform/abstractions/key-generation.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { StateService } from "../../../platform/abstractions/state.service";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { MasterKey } from "../../../types/key";
import { EncryptService } from "../../crypto/abstractions/encrypt.service";
import { EncString } from "../../crypto/models/enc-string";

import { MasterPasswordService } from "./master-password.service";

describe("MasterPasswordService", () => {
  let sut: MasterPasswordService;

  let stateProvider: MockProxy<StateProvider>;
  let stateService: MockProxy<StateService>;
  let keyGenerationService: MockProxy<KeyGenerationService>;
  let encryptService: MockProxy<EncryptService>;
  let logService: MockProxy<LogService>;

  const userId = "user-id" as UserId;
  const mockUserState = {
    state$: of(null),
    update: jest.fn().mockResolvedValue(null),
  };

  const testUserKey: SymmetricCryptoKey = makeSymmetricCryptoKey(64, 1);
  const testMasterKey: MasterKey = makeSymmetricCryptoKey(32, 2);
  const testStretchedMasterKey: SymmetricCryptoKey = makeSymmetricCryptoKey(64, 3);
  const testMasterKeyEncryptedKey =
    "0.gbauOANURUHqvhLTDnva1A==|nSW+fPumiuTaDB/s12+JO88uemV6rhwRSR+YR1ZzGr5j6Ei3/h+XEli2Unpz652NlZ9NTuRpHxeOqkYYJtp7J+lPMoclgteXuAzUu9kqlRc=";
  const testStretchedMasterKeyEncryptedKey =
    "2.gbauOANURUHqvhLTDnva1A==|nSW+fPumiuTaDB/s12+JO88uemV6rhwRSR+YR1ZzGr5j6Ei3/h+XEli2Unpz652NlZ9NTuRpHxeOqkYYJtp7J+lPMoclgteXuAzUu9kqlRc=|DeUFkhIwgkGdZA08bDnDqMMNmZk21D+H5g8IostPKAY=";

  beforeEach(() => {
    stateProvider = mock<StateProvider>();
    stateService = mock<StateService>();
    keyGenerationService = mock<KeyGenerationService>();
    encryptService = mock<EncryptService>();
    logService = mock<LogService>();

    stateProvider.getUser.mockReturnValue(mockUserState as any);

    mockUserState.update.mockReset();

    sut = new MasterPasswordService(
      stateProvider,
      stateService,
      keyGenerationService,
      encryptService,
      logService,
    );

    encryptService.unwrapSymmetricKey.mockResolvedValue(makeSymmetricCryptoKey(64, 1));
    keyGenerationService.stretchKey.mockResolvedValue(makeSymmetricCryptoKey(64, 3));
  });

  describe("setForceSetPasswordReason", () => {
    it("calls stateProvider with the provided reason and user ID", async () => {
      const reason = ForceSetPasswordReason.WeakMasterPassword;

      await sut.setForceSetPasswordReason(reason, userId);

      expect(stateProvider.getUser).toHaveBeenCalled();
      expect(mockUserState.update).toHaveBeenCalled();

      // Call the update function to verify it returns the correct reason
      const updateFn = mockUserState.update.mock.calls[0][0];
      expect(updateFn(null)).toBe(reason);
    });

    it("throws an error if reason is null", async () => {
      await expect(
        sut.setForceSetPasswordReason(null as unknown as ForceSetPasswordReason, userId),
      ).rejects.toThrow("Reason is required.");
    });

    it("throws an error if user ID is null", async () => {
      await expect(
        sut.setForceSetPasswordReason(ForceSetPasswordReason.None, null as unknown as UserId),
      ).rejects.toThrow("User ID is required.");
    });

    it("does not overwrite AdminForcePasswordReset with other reasons except None", async () => {
      jest
        .spyOn(sut, "forceSetPasswordReason$")
        .mockReturnValue(of(ForceSetPasswordReason.AdminForcePasswordReset));

      jest
        .spyOn(rxjs, "firstValueFrom")
        .mockResolvedValue(ForceSetPasswordReason.AdminForcePasswordReset);

      await sut.setForceSetPasswordReason(ForceSetPasswordReason.WeakMasterPassword, userId);

      expect(mockUserState.update).not.toHaveBeenCalled();
    });

    it("allows overwriting AdminForcePasswordReset with None", async () => {
      jest
        .spyOn(sut, "forceSetPasswordReason$")
        .mockReturnValue(of(ForceSetPasswordReason.AdminForcePasswordReset));

      jest
        .spyOn(rxjs, "firstValueFrom")
        .mockResolvedValue(ForceSetPasswordReason.AdminForcePasswordReset);

      await sut.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);

      expect(mockUserState.update).toHaveBeenCalled();
    });
  });
  describe("decryptUserKeyWithMasterKey", () => {
    it("decrypts a userkey wrapped in AES256-CBC", async () => {
      encryptService.unwrapSymmetricKey.mockResolvedValue(testUserKey);
      await sut.decryptUserKeyWithMasterKey(
        testMasterKey,
        userId,
        new EncString(testMasterKeyEncryptedKey),
      );
      expect(encryptService.unwrapSymmetricKey).toHaveBeenCalledWith(
        new EncString(testMasterKeyEncryptedKey),
        testMasterKey,
      );
    });
    it("decrypts a userkey wrapped in AES256-CBC-HMAC", async () => {
      encryptService.unwrapSymmetricKey.mockResolvedValue(testUserKey);
      keyGenerationService.stretchKey.mockResolvedValue(testStretchedMasterKey);
      await sut.decryptUserKeyWithMasterKey(
        testMasterKey,
        userId,
        new EncString(testStretchedMasterKeyEncryptedKey),
      );
      expect(encryptService.unwrapSymmetricKey).toHaveBeenCalledWith(
        new EncString(testStretchedMasterKeyEncryptedKey),
        testStretchedMasterKey,
      );
      expect(keyGenerationService.stretchKey).toHaveBeenCalledWith(testMasterKey);
    });
    it("returns null if failed to decrypt", async () => {
      encryptService.unwrapSymmetricKey.mockResolvedValue(null);
      const result = await sut.decryptUserKeyWithMasterKey(
        testMasterKey,
        userId,
        new EncString(testStretchedMasterKeyEncryptedKey),
      );
      expect(result).toBeNull();
    });
  });

  describe("setMasterKeyEncryptedUserKey", () => {
    test.each([null as unknown as EncString, undefined as unknown as EncString])(
      "throws when the provided encryptedKey is %s",
      async (encryptedKey) => {
        await expect(sut.setMasterKeyEncryptedUserKey(encryptedKey, userId)).rejects.toThrow(
          "Encrypted Key is required.",
        );
      },
    );

    it("throws an error if encryptedKey is malformed null", async () => {
      await expect(
        sut.setMasterKeyEncryptedUserKey(new EncString(null as unknown as string), userId),
      ).rejects.toThrow("Encrypted Key is required.");
    });

    test.each([null as unknown as UserId, undefined as unknown as UserId])(
      "throws when the provided userId is %s",
      async (userId) => {
        await expect(
          sut.setMasterKeyEncryptedUserKey(new EncString(testMasterKeyEncryptedKey), userId),
        ).rejects.toThrow("User ID is required.");
      },
    );

    it("calls stateProvider with the provided encryptedKey and user ID", async () => {
      const encryptedKey = new EncString(testMasterKeyEncryptedKey);

      await sut.setMasterKeyEncryptedUserKey(encryptedKey, userId);

      expect(stateProvider.getUser).toHaveBeenCalled();
      expect(mockUserState.update).toHaveBeenCalled();
      const updateFn = mockUserState.update.mock.calls[0][0];
      expect(updateFn(null)).toEqual(encryptedKey.toJSON());
    });
  });
});
