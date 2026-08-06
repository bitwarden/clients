import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { LockService } from "@bitwarden/auth/common";
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { UserId as SdkUserId } from "@bitwarden/sdk-internal";
import { UnlockService } from "@bitwarden/unlock";

import { AccountService } from "../../auth/abstractions/account.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "../../types/csprng";
import { UserId } from "../../types/guid";
import { UserKey } from "../../types/key";
import { LockSource } from "../lock";
import { VaultTimeoutSettingsService } from "../vault-timeout/abstractions/vault-timeout-settings.service";

import { JsSharedUnlockDriver } from "./shared-unlock-driver";

describe("JsSharedUnlockDriver", () => {
  const userId = "b1e2d3c4-a1b2-c3d4-e5f6-a1b2c3d4e5f6" as UserId;
  const sdkUserId = asUuid<SdkUserId>(userId);
  const userKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;

  let accountService: MockProxy<AccountService>;
  let lockService: MockProxy<LockService>;
  let unlockService: MockProxy<UnlockService>;
  let keyService: MockProxy<KeyService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let environmentService: MockProxy<EnvironmentService>;
  let isEnabled: jest.Mock;
  let onExternalUnlock: jest.Mock;

  let sut: JsSharedUnlockDriver;

  beforeEach(() => {
    accountService = mock<AccountService>();
    lockService = mock<LockService>();
    unlockService = mock<UnlockService>();
    keyService = mock<KeyService>();
    platformUtilsService = mock<PlatformUtilsService>();
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    environmentService = mock<EnvironmentService>();
    isEnabled = jest.fn().mockResolvedValue(true);
    onExternalUnlock = jest.fn();

    keyService.userKey$.mockReturnValue(of(userKey));

    sut = new JsSharedUnlockDriver(
      accountService,
      lockService,
      unlockService,
      keyService,
      platformUtilsService,
      vaultTimeoutSettingsService,
      environmentService,
      isEnabled,
      onExternalUnlock,
    );
  });

  describe("lock_user", () => {
    it("locks with the shared unlock source", async () => {
      await sut.lock_user(sdkUserId);

      expect(lockService.lock).toHaveBeenCalledWith(userId, LockSource.SharedUnlock);
    });

    it("does nothing when shared unlock is not enabled for the user", async () => {
      isEnabled.mockResolvedValue(false);

      await sut.lock_user(sdkUserId);

      expect(lockService.lock).not.toHaveBeenCalled();
    });
  });

  describe("unlock_user", () => {
    it("unlocks through the shared unlock method so the unlock is not broadcast back out", async () => {
      await sut.unlock_user(sdkUserId, userKey.toSdk());

      expect(unlockService.unlockWithSharedUnlock).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ keyB64: userKey.toBase64() }),
      );
      expect(unlockService.unlockWithDecryptedUserKey).not.toHaveBeenCalled();
      expect(onExternalUnlock).toHaveBeenCalledWith(userId);
    });

    it("does nothing when shared unlock is not enabled for the user", async () => {
      isEnabled.mockResolvedValue(false);

      await sut.unlock_user(sdkUserId, userKey.toSdk());

      expect(unlockService.unlockWithSharedUnlock).not.toHaveBeenCalled();
      expect(onExternalUnlock).not.toHaveBeenCalled();
    });
  });
});
