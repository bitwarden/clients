import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { newGuid } from "@bitwarden/guid";
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { UserId } from "@bitwarden/user-core";

import { HashPurpose } from "../../../platform/enums";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { MasterKey, UserKey } from "../../../types/key";
import { InternalMasterPasswordServiceAbstraction } from "../abstractions/master-password.service.abstraction";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../types/master-password.types";

import { DefaultMasterPasswordUnlockService } from "./default-master-password-unlock.service";

describe("DefaultMasterPasswordUnlockService", () => {
  let sut: DefaultMasterPasswordUnlockService;

  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let keyService: MockProxy<KeyService>;
  let logService: MockProxy<LogService>;

  const mockMasterPassword = "testExample";
  const mockUserId = newGuid() as UserId;

  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const mockMasterPasswordUnlockData: MasterPasswordUnlockData = new MasterPasswordUnlockData(
    "user@example.com" as MasterPasswordSalt,
    new Argon2KdfConfig(100000, 64, 1),
    "encryptedMasterKeyWrappedUserKey" as MasterKeyWrappedUserKey,
  );

  //Legacy data for tests
  const mockMasterKey = new SymmetricCryptoKey(new Uint8Array(32)) as MasterKey;
  const mockKeyHash = "localKeyHash";

  beforeEach(() => {
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    keyService = mock<KeyService>();
    logService = mock<LogService>();

    sut = new DefaultMasterPasswordUnlockService(masterPasswordService, keyService, logService);

    masterPasswordService.masterPasswordUnlockData$.mockReturnValue(
      of(mockMasterPasswordUnlockData),
    );
    masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData.mockResolvedValue(mockUserKey);

    // Legacy state mocking
    keyService.makeMasterKey.mockResolvedValue(mockMasterKey);
    keyService.hashMasterKey.mockResolvedValue(mockKeyHash);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("unlockWithMasterPassword", () => {
    test.each([null as unknown as string, undefined as unknown as string, ""])(
      "throws when the provided master password is %s",
      async (masterPassword) => {
        await expect(sut.unlockWithMasterPassword(masterPassword, mockUserId)).rejects.toThrow(
          "Master password is required",
        );
        expect(masterPasswordService.masterPasswordUnlockData$).not.toHaveBeenCalled();
        expect(
          masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData,
        ).not.toHaveBeenCalled();
      },
    );

    test.each([null as unknown as UserId, undefined as unknown as UserId])(
      "throws when the provided userID is %s",
      async (userId) => {
        await expect(sut.unlockWithMasterPassword(mockMasterPassword, userId)).rejects.toThrow(
          "User ID is required",
        );
      },
    );

    it("throws an error when the user doesn't have masterPasswordUnlockData", async () => {
      masterPasswordService.masterPasswordUnlockData$.mockReturnValue(of(null));

      await expect(sut.unlockWithMasterPassword(mockMasterPassword, mockUserId)).rejects.toThrow(
        "Master password unlock data was not found for the user " + mockUserId,
      );
      expect(masterPasswordService.masterPasswordUnlockData$).toHaveBeenCalledWith(mockUserId);
      expect(
        masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData,
      ).not.toHaveBeenCalled();
    });

    it("returns userKey successfully", async () => {
      const result = await sut.unlockWithMasterPassword(mockMasterPassword, mockUserId);

      expect(result).toEqual(mockUserKey);
      expect(masterPasswordService.masterPasswordUnlockData$).toHaveBeenCalledWith(mockUserId);
      expect(masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData).toHaveBeenCalledWith(
        mockMasterPassword,
        mockMasterPasswordUnlockData,
      );
    });

    it("sets legacy state on success", async () => {
      const result = await sut.unlockWithMasterPassword(mockMasterPassword, mockUserId);

      expect(result).toEqual(mockUserKey);
      expect(masterPasswordService.masterPasswordUnlockData$).toHaveBeenCalledWith(mockUserId);
      expect(masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData).toHaveBeenCalledWith(
        mockMasterPassword,
        mockMasterPasswordUnlockData,
      );

      expect(keyService.makeMasterKey).toHaveBeenCalledWith(
        mockMasterPassword,
        mockMasterPasswordUnlockData.salt,
        mockMasterPasswordUnlockData.kdf,
      );
      expect(keyService.hashMasterKey).toHaveBeenCalledWith(
        mockMasterPassword,
        mockMasterKey,
        HashPurpose.LocalAuthorization,
      );
      expect(masterPasswordService.setMasterKeyHash).toHaveBeenCalledWith(mockKeyHash, mockUserId);
      expect(masterPasswordService.setMasterKey).toHaveBeenCalledWith(mockMasterKey, mockUserId);
    });

    it("throws an error if masterKey construction fails", async () => {
      keyService.makeMasterKey.mockResolvedValue(null as unknown as MasterKey);

      await expect(sut.unlockWithMasterPassword(mockMasterPassword, mockUserId)).rejects.toThrow(
        "Master key could not be created to set legacy master password state.",
      );

      expect(masterPasswordService.masterPasswordUnlockData$).toHaveBeenCalledWith(mockUserId);
      expect(masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData).toHaveBeenCalledWith(
        mockMasterPassword,
        mockMasterPasswordUnlockData,
      );

      expect(keyService.makeMasterKey).toHaveBeenCalledWith(
        mockMasterPassword,
        mockMasterPasswordUnlockData.salt,
        mockMasterPasswordUnlockData.kdf,
      );
      expect(keyService.hashMasterKey).not.toHaveBeenCalled();
      expect(masterPasswordService.setMasterKeyHash).not.toHaveBeenCalled();
      expect(masterPasswordService.setMasterKey).not.toHaveBeenCalled();
    });
  });

  describe("proofOfDecryption", () => {
    test.each([null as unknown as string, undefined as unknown as string, ""])(
      "throws when the provided master password is %s",
      async (masterPassword) => {
        await expect(sut.proofOfDecryption(masterPassword, mockUserId)).rejects.toThrow(
          "Master password is required",
        );
        expect(masterPasswordService.masterPasswordUnlockData$).not.toHaveBeenCalled();
        expect(
          masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData,
        ).not.toHaveBeenCalled();
      },
    );

    test.each([null as unknown as UserId, undefined as unknown as UserId])(
      "throws when the provided userID is %s",
      async (userId) => {
        await expect(sut.proofOfDecryption(mockMasterPassword, userId)).rejects.toThrow(
          "User ID is required",
        );
      },
    );

    it("returns false when the user doesn't have masterPasswordUnlockData", async () => {
      masterPasswordService.masterPasswordUnlockData$.mockReturnValue(of(null));

      const result = await sut.proofOfDecryption(mockMasterPassword, mockUserId);

      expect(result).toBe(false);
      expect(masterPasswordService.masterPasswordUnlockData$).toHaveBeenCalledWith(mockUserId);
      expect(
        masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData,
      ).not.toHaveBeenCalled();
      expect(logService.warning).toHaveBeenCalledWith(
        "[DefaultMasterPasswordUnlockService] proofOfDecryption: No master password unlock data found for user " +
          mockUserId +
          " returning false.",
      );
    });

    it("returns true when the master password is correct", async () => {
      const result = await sut.proofOfDecryption(mockMasterPassword, mockUserId);

      expect(result).toBe(true);
      expect(masterPasswordService.masterPasswordUnlockData$).toHaveBeenCalledWith(mockUserId);
      expect(masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData).toHaveBeenCalledWith(
        mockMasterPassword,
        mockMasterPasswordUnlockData,
      );
    });

    it("returns false when the master password is incorrect", async () => {
      masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData.mockRejectedValue(
        new Error("Incorrect password"),
      );

      const result = await sut.proofOfDecryption(mockMasterPassword, mockUserId);

      expect(result).toBe(false);
      expect(masterPasswordService.masterPasswordUnlockData$).toHaveBeenCalledWith(mockUserId);
      expect(masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData).toHaveBeenCalledWith(
        mockMasterPassword,
        mockMasterPasswordUnlockData,
      );
      expect(logService.debug).toHaveBeenCalledWith(
        "[DefaultMasterPasswordUnlockService] proofOfDecryption: Error during proof of decryption for user " +
          mockUserId +
          " returning false. Error: Incorrect password",
      );
    });
  });
});
