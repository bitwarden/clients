import { mock } from "jest-mock-extended";

import { LockService, UnlockService } from "@bitwarden/unlock";

import { FakeStateProvider, mockAccountServiceWith } from "../../../spec";
import { AccountService } from "../../auth/abstractions/account.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../types/guid";
import { VaultTimeoutSettingsService } from "../vault-timeout/abstractions/vault-timeout-settings.service";

import { JsSharedUnlockDriver, LAST_MANUAL_LOCK } from "./shared-unlock-driver";

describe("JsSharedUnlockDriver", () => {
  const userId = "00000000-0000-0000-0000-000000000001" as UserId;
  const lockedAt = 1_700_000_000_000;

  let stateProvider: FakeStateProvider;
  let driver: JsSharedUnlockDriver;

  beforeEach(() => {
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    driver = new JsSharedUnlockDriver(
      mock<AccountService>(),
      mock<LockService>(),
      mock<UnlockService>(),
      mock<PlatformUtilsService>(),
      mock<VaultTimeoutSettingsService>(),
      mock<EnvironmentService>(),
      stateProvider,
    );
  });

  describe("last manual lock", () => {
    it("returns undefined when nothing is persisted", async () => {
      await expect(driver.get_last_manual_lock(asUuid(userId))).resolves.toBeUndefined();
    });

    it("persists the date to user state", async () => {
      await driver.set_last_manual_lock(asUuid(userId), lockedAt);

      expect(
        stateProvider.singleUser.getFake(userId, LAST_MANUAL_LOCK).nextMock,
      ).toHaveBeenCalledWith(lockedAt);
    });

    it("returns the persisted date", async () => {
      await driver.set_last_manual_lock(asUuid(userId), lockedAt);

      await expect(driver.get_last_manual_lock(asUuid(userId))).resolves.toBe(lockedAt);
    });
  });
});
