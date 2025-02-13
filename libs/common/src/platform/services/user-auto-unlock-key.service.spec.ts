import { mock } from "jest-mock-extended";

import { DefaultKeyService } from "@bitwarden/key-management";

import { CsprngArray } from "../../types/csprng";
import { UserId } from "../../types/guid";
import { UserKey } from "../../types/key";
import { KeySuffixOptions } from "../enums";
import { Utils } from "../misc/utils";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";

import { UserAutoUnlockKeyService } from "./user-auto-unlock-key.service";

describe("UserAutoUnlockKeyService", () => {
  let userAutoUnlockKeyService: UserAutoUnlockKeyService;

  const mockUserId = Utils.newGuid() as UserId;

  const keyService = mock<DefaultKeyService>();

  beforeEach(() => {
    userAutoUnlockKeyService = new UserAutoUnlockKeyService(keyService);
  });

  describe("setUserKeyInMemoryIfAutoUserKeySet", () => {
    it("does nothing if the userId is null", async () => {
      // Act
      await (userAutoUnlockKeyService as any).setUserKeyInMemoryIfAutoUserKeySet(null);

      // Assert
      expect(keyService.getUserKeyFromStorage).not.toHaveBeenCalled();
      expect(keyService.setUserKey).not.toHaveBeenCalled();
    });

    it("does nothing if the autoUserKey is null", async () => {
      // Arrange
      const userId = mockUserId;

      keyService.getUserKeyFromStorage.mockResolvedValue(null);

      // Act
      await (userAutoUnlockKeyService as any).setUserKeyInMemoryIfAutoUserKeySet(userId);

      // Assert
      expect(keyService.getUserKeyFromStorage).toHaveBeenCalledWith(KeySuffixOptions.Auto, userId);
      expect(keyService.setUserKey).not.toHaveBeenCalled();
    });

    it("sets the user key in memory if the autoUserKey is not null", async () => {
      // Arrange
      const userId = mockUserId;

      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      const mockAutoUserKey: UserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;

      keyService.getUserKeyFromStorage.mockResolvedValue(mockAutoUserKey);

      // Act
      await (userAutoUnlockKeyService as any).setUserKeyInMemoryIfAutoUserKeySet(userId);

      // Assert
      expect(keyService.getUserKeyFromStorage).toHaveBeenCalledWith(KeySuffixOptions.Auto, userId);
      expect(keyService.setUserKey).toHaveBeenCalledWith(mockAutoUserKey, userId);
    });
  });
});
