import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import {
  VAULT_TIMEOUT,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { CsprngArray, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { StateProvider, StateService } from "@bitwarden/state";

import { DefaultAutoUnlockService } from "./default-auto-unlock.service";

describe("DefaultAutoUnlockService", () => {
  const mockUserId = "b1e2d3c4-a1b2-c3d4-e5f6-a1b2c3d4e5f6" as UserId;
  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;

  const keyService = mock<KeyService>();
  const stateService = mock<StateService>();
  const stateProvider = mock<StateProvider>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const logService = mock<LogService>();

  let sut: DefaultAutoUnlockService;

  beforeEach(() => {
    jest.resetAllMocks();

    platformUtilsService.getClientType.mockReturnValue(ClientType.Browser);
    stateProvider.getUserState$.mockReturnValue(of(VaultTimeoutStringType.Never));
    keyService.userKey$.mockReturnValue(of(mockUserKey));

    sut = new DefaultAutoUnlockService(
      keyService,
      stateService,
      stateProvider,
      platformUtilsService,
      logService,
    );
  });

  describe("setAutoUnlockKey", () => {
    it("stores the key when the vault timeout is never", async () => {
      await sut.setAutoUnlockKey(mockUserId, mockUserKey);

      expect(stateProvider.getUserState$).toHaveBeenCalledWith(VAULT_TIMEOUT, mockUserId);
      expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(mockUserKey.toBase64(), {
        userId: mockUserId,
      });
    });

    it("stores the key on the cli without reading the vault timeout", async () => {
      platformUtilsService.getClientType.mockReturnValue(ClientType.Cli);
      stateProvider.getUserState$.mockReturnValue(of(60));

      await sut.setAutoUnlockKey(mockUserId, mockUserKey);

      expect(stateProvider.getUserState$).not.toHaveBeenCalled();
      expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(mockUserKey.toBase64(), {
        userId: mockUserId,
      });
    });

    it.each([60, VaultTimeoutStringType.OnRestart, VaultTimeoutStringType.OnLocked])(
      "clears the key when the vault timeout is %s",
      async (timeout) => {
        stateProvider.getUserState$.mockReturnValue(of(timeout));

        await sut.setAutoUnlockKey(mockUserId, mockUserKey);

        expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
      },
    );
  });

  describe("getAutoUnlockKey", () => {
    it("returns null when no never-lock key is stored", async () => {
      stateService.getUserKeyAutoUnlock.mockResolvedValue(null);

      const result = await sut.getAutoUnlockKey(mockUserId);

      expect(result).toBeNull();
      expect(stateService.getUserKeyAutoUnlock).toHaveBeenCalledWith({ userId: mockUserId });
      expect(keyService.validateUserKey).not.toHaveBeenCalled();
    });

    it("returns the stored key when it is valid", async () => {
      stateService.getUserKeyAutoUnlock.mockResolvedValue(mockUserKey.keyB64);
      keyService.validateUserKey.mockResolvedValue(true);

      const result = await sut.getAutoUnlockKey(mockUserId);

      expect(result).toEqual(mockUserKey);
      expect(keyService.validateUserKey).toHaveBeenCalledWith(mockUserKey, mockUserId);
      expect(keyService.clearAllStoredUserKeys).not.toHaveBeenCalled();
    });

    it("throws away the stored keys and returns null when the stored key fails validation", async () => {
      stateService.getUserKeyAutoUnlock.mockResolvedValue(mockUserKey.keyB64);
      keyService.validateUserKey.mockResolvedValue(false);

      const result = await sut.getAutoUnlockKey(mockUserId);

      expect(result).toBeNull();
      expect(logService.warning).toHaveBeenCalledWith("Invalid key, throwing away stored keys");
      expect(keyService.clearAllStoredUserKeys).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe("refreshAutoUnlockKey", () => {
    it("re-stores the in-memory user key", async () => {
      await sut.refreshAutoUnlockKey(mockUserId);

      expect(keyService.userKey$).toHaveBeenCalledWith(mockUserId);
      expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(mockUserKey.toBase64(), {
        userId: mockUserId,
      });
    });

    it("clears the stored key when the vault timeout no longer allows it", async () => {
      stateProvider.getUserState$.mockReturnValue(of(VaultTimeoutStringType.OnLocked));

      await sut.refreshAutoUnlockKey(mockUserId);

      expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(null, { userId: mockUserId });
    });

    it.each([null as unknown as UserId, undefined as unknown as UserId])(
      "throws when the provided userId is %s",
      async (userId) => {
        await expect(sut.refreshAutoUnlockKey(userId)).rejects.toThrow("UserId is required.");

        expect(stateService.setUserKeyAutoUnlock).not.toHaveBeenCalled();
      },
    );

    it("throws when the user is locked", async () => {
      keyService.userKey$.mockReturnValue(of(null));

      await expect(sut.refreshAutoUnlockKey(mockUserId)).rejects.toThrow(
        "No user key found for: " + mockUserId,
      );

      expect(stateService.setUserKeyAutoUnlock).not.toHaveBeenCalled();
    });
  });
});
