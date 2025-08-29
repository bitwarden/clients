import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { Account } from "../../../auth/abstractions/account.service";
import { HashPurpose } from "../../../platform/enums";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { MasterKey, UserKey } from "../../../types/key";
import { EncString } from "../../crypto/models/enc-string";
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

  const mockMasterPassword = "testExample";
  const activeAccount: Account = {
    id: "user-id" as UserId,
    email: "user@example.com",
    emailVerified: true,
    name: "User",
  };
  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const mockMasterPasswordUnlockData: MasterPasswordUnlockData = new MasterPasswordUnlockData(
    "user@example.com" as MasterPasswordSalt,
    new Argon2KdfConfig(100000, 64, 1),
    new EncString("encryptedMasterKeyWrappedUserKey") as MasterKeyWrappedUserKey,
  );

  //Legacy data for tests
  const mockMasterKey = new SymmetricCryptoKey(new Uint8Array(32)) as MasterKey;
  const mockKeyHash = "localKeyHash";

  beforeEach(() => {
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    keyService = mock<KeyService>();

    sut = new DefaultMasterPasswordUnlockService(masterPasswordService, keyService);

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
        await expect(sut.unlockWithMasterPassword(masterPassword, activeAccount)).rejects.toThrow(
          "Master password is required",
        );
        expect(masterPasswordService.masterPasswordUnlockData$).not.toHaveBeenCalled();
        expect(
          masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData,
        ).not.toHaveBeenCalled();
      },
    );

    test.each([null as unknown as Account, undefined as unknown as Account])(
      "throws when the provided master password is %s",
      async (account) => {
        await expect(sut.unlockWithMasterPassword(mockMasterPassword, account)).rejects.toThrow(
          "Active account is required",
        );
      },
    );

    it("throws an error when the user doesn't have masterPasswordUnlockData", async () => {
      masterPasswordService.masterPasswordUnlockData$.mockReturnValue(of(null));

      await expect(sut.unlockWithMasterPassword(mockMasterPassword, activeAccount)).rejects.toThrow(
        "Master password unlock data was not found for the user " + activeAccount.id,
      );
      expect(masterPasswordService.masterPasswordUnlockData$).toHaveBeenCalledWith(
        activeAccount.id,
      );
      expect(
        masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData,
      ).not.toHaveBeenCalled();
    });

    test.each([null as unknown as UserKey, undefined as unknown as UserKey])(
      "throws when the unwrap userKey is %s",
      async (userKey) => {
        masterPasswordService.masterPasswordUnlockData$.mockReturnValue(
          of(mockMasterPasswordUnlockData),
        );
        masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData.mockResolvedValue(userKey);

        await expect(
          sut.unlockWithMasterPassword(mockMasterPassword, activeAccount),
        ).rejects.toThrow("User key couldn't be decrypted");
        expect(masterPasswordService.masterPasswordUnlockData$).toHaveBeenCalledWith(
          activeAccount.id,
        );
        expect(
          masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData,
        ).toHaveBeenCalledWith(mockMasterPassword, mockMasterPasswordUnlockData);
      },
    );

    it("returns userKey successfully", async () => {
      const result = await sut.unlockWithMasterPassword(mockMasterPassword, activeAccount);

      expect(result).toEqual(mockUserKey);
      expect(masterPasswordService.masterPasswordUnlockData$).toHaveBeenCalledWith(
        activeAccount.id,
      );
      expect(masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData).toHaveBeenCalledWith(
        mockMasterPassword,
        mockMasterPasswordUnlockData,
      );
    });

    it("sets legacy state on success", async () => {
      const result = await sut.unlockWithMasterPassword(mockMasterPassword, activeAccount);

      expect(result).toEqual(mockUserKey);
      expect(masterPasswordService.masterPasswordUnlockData$).toHaveBeenCalledWith(
        activeAccount.id,
      );
      expect(masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData).toHaveBeenCalledWith(
        mockMasterPassword,
        mockMasterPasswordUnlockData,
      );

      expect(keyService.makeMasterKey).toHaveBeenCalledWith(
        mockMasterPassword,
        activeAccount.email,
        mockMasterPasswordUnlockData.kdf,
      );
      expect(keyService.hashMasterKey).toHaveBeenCalledWith(
        mockMasterPassword,
        mockMasterKey,
        HashPurpose.LocalAuthorization,
      );
      expect(masterPasswordService.setMasterKeyHash).toHaveBeenCalledWith(
        mockKeyHash,
        activeAccount.id,
      );
      expect(masterPasswordService.setMasterKey).toHaveBeenCalledWith(
        mockMasterKey,
        activeAccount.id,
      );
    });

    it("throws an error if masterKey construction fails", async () => {
      keyService.makeMasterKey.mockResolvedValue(null as unknown as MasterKey);

      await expect(sut.unlockWithMasterPassword(mockMasterPassword, activeAccount)).rejects.toThrow(
        "Master key could not be created to set legacy master password state.",
      );

      expect(masterPasswordService.masterPasswordUnlockData$).toHaveBeenCalledWith(
        activeAccount.id,
      );
      expect(masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData).toHaveBeenCalledWith(
        mockMasterPassword,
        mockMasterPasswordUnlockData,
      );

      expect(keyService.makeMasterKey).toHaveBeenCalledWith(
        mockMasterPassword,
        activeAccount.email,
        mockMasterPasswordUnlockData.kdf,
      );
      expect(keyService.hashMasterKey).not.toHaveBeenCalled();
      expect(masterPasswordService.setMasterKeyHash).not.toHaveBeenCalled();
      expect(masterPasswordService.setMasterKey).not.toHaveBeenCalled();
    });
  });
});
