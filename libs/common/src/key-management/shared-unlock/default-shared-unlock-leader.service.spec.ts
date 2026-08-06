import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { LockService } from "@bitwarden/auth/common";
import { ClientType } from "@bitwarden/client-type";
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { SharedUnlockLeader } from "@bitwarden/sdk-internal";
import { UnlockService, UnlockSource } from "@bitwarden/unlock";

import { AccountService } from "../../auth/abstractions/account.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { IpcService } from "../../platform/ipc";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "../../types/csprng";
import { UserId } from "../../types/guid";
import { UserKey } from "../../types/key";
import { LockSource } from "../lock";
import { VaultTimeoutSettingsService } from "../vault-timeout/abstractions/vault-timeout-settings.service";

import { DefaultSharedUnlockLeaderService } from "./default-shared-unlock-leader.service";
import { SharedUnlockSettingsService } from "./shared-unlock-settings.service";

describe("DefaultSharedUnlockLeaderService", () => {
  const userId = "b1e2d3c4-a1b2-c3d4-e5f6-a1b2c3d4e5f6" as UserId;
  const userKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;

  let ipcService: MockProxy<IpcService>;
  let accountService: MockProxy<AccountService>;
  let lockService: MockProxy<LockService>;
  let keyService: MockProxy<KeyService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let environmentService: MockProxy<EnvironmentService>;
  let sharedUnlockSettingsService: MockProxy<SharedUnlockSettingsService>;
  let unlockService: MockProxy<UnlockService>;
  let leader: { start: jest.Mock; handle_device_event: jest.Mock };

  let sut: DefaultSharedUnlockLeaderService;

  const onLockAction = () => lockService.registerOnLockAction.mock.calls[0][0];
  const onUnlockAction = () => unlockService.registerOnUnlockAction.mock.calls[0][0];

  beforeEach(() => {
    ipcService = mock<IpcService>();
    accountService = mock<AccountService>();
    lockService = mock<LockService>();
    keyService = mock<KeyService>();
    platformUtilsService = mock<PlatformUtilsService>();
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    environmentService = mock<EnvironmentService>();
    sharedUnlockSettingsService = mock<SharedUnlockSettingsService>();
    unlockService = mock<UnlockService>();

    leader = {
      start: jest.fn().mockResolvedValue(undefined),
      handle_device_event: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(SharedUnlockLeader, "try_new").mockReturnValue(leader as never);

    platformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);
    sharedUnlockSettingsService.unlockSharingDisabled$.mockReturnValue(of(false));
    keyService.userKey$.mockReturnValue(of(userKey));

    sut = new DefaultSharedUnlockLeaderService(
      ipcService,
      accountService,
      lockService,
      keyService,
      platformUtilsService,
      vaultTimeoutSettingsService,
      environmentService,
      sharedUnlockSettingsService,
      unlockService,
    );
  });

  describe("on lock", () => {
    it.each([LockSource.Manual, LockSource.VaultTimeout])(
      "reports a %s lock to the leader",
      async (source) => {
        await sut.start();

        await onLockAction()(userId, source);

        expect(leader.handle_device_event).toHaveBeenCalledWith({
          ManualLock: { user_id: userId },
        });
      },
    );

    it("ignores a lock caused by shared unlock", async () => {
      await sut.start();

      await onLockAction()(userId, LockSource.SharedUnlock);

      expect(leader.handle_device_event).not.toHaveBeenCalled();
    });
  });

  describe("on unlock", () => {
    it.each([UnlockSource.Manual, UnlockSource.NeverLock])(
      "reports a %s unlock to the leader",
      async (source) => {
        await sut.start();

        await onUnlockAction()(userId, userKey, source);

        expect(leader.handle_device_event).toHaveBeenCalledWith({
          ManualUnlock: { user_id: userId, user_key: userKey.toSdk() },
        });
      },
    );

    it("ignores an unlock caused by shared unlock", async () => {
      await sut.start();

      await onUnlockAction()(userId, userKey, UnlockSource.SharedUnlock);

      expect(leader.handle_device_event).not.toHaveBeenCalled();
    });
  });

  describe("notifyUnlock", () => {
    it("reports the unlock using the user key from state", async () => {
      await sut.start();

      await sut.notifyUnlock(userId, UnlockSource.Manual);

      expect(keyService.userKey$).toHaveBeenCalledWith(userId);
      expect(leader.handle_device_event).toHaveBeenCalledWith({
        ManualUnlock: { user_id: userId, user_key: userKey.toSdk() },
      });
    });

    it("does nothing when the service has not been started", async () => {
      await sut.notifyUnlock(userId, UnlockSource.Manual);

      expect(leader.handle_device_event).not.toHaveBeenCalled();
    });

    it("does nothing when the user has no user key", async () => {
      keyService.userKey$.mockReturnValue(of(null));
      await sut.start();

      await sut.notifyUnlock(userId, UnlockSource.Manual);

      expect(leader.handle_device_event).not.toHaveBeenCalled();
    });

    it("ignores an unlock caused by shared unlock", async () => {
      await sut.start();

      await sut.notifyUnlock(userId, UnlockSource.SharedUnlock);

      expect(leader.handle_device_event).not.toHaveBeenCalled();
    });
  });
});
