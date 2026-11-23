import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  VaultTimeoutAction,
  VaultTimeoutService,
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { LockService, LockSource } from "@bitwarden/unlock";

import { HeadlessVaultTimeoutMain } from "./headless-vault-timeout.main";

const userA = "user-a" as UserId;
const userB = "user-b" as UserId;

describe("HeadlessVaultTimeoutMain", () => {
  let vaultTimeoutService: MockProxy<VaultTimeoutService>;
  let settings: MockProxy<VaultTimeoutSettingsService>;
  let accountService: MockProxy<AccountService>;
  let lockService: MockProxy<LockService>;
  let accounts$: BehaviorSubject<Record<UserId, unknown>>;

  const buildSut = (flagEnabled: boolean) =>
    new HeadlessVaultTimeoutMain(
      flagEnabled,
      vaultTimeoutService,
      settings,
      accountService,
      lockService,
      mock<LogService>(),
    );

  let sut: HeadlessVaultTimeoutMain;

  beforeEach(() => {
    jest.useFakeTimers();

    vaultTimeoutService = mock<VaultTimeoutService>();
    vaultTimeoutService.checkVaultTimeout.mockResolvedValue();
    settings = mock<VaultTimeoutSettingsService>();
    settings.isVaultTimeoutSuppressed.mockResolvedValue(false);
    settings.getVaultTimeoutActionByUserId$.mockReturnValue(of(VaultTimeoutAction.Lock));
    accounts$ = new BehaviorSubject<Record<UserId, unknown>>({ [userA]: {}, [userB]: {} });
    accountService = mock<AccountService>();
    Object.assign(accountService, { accounts$ });
    lockService = mock<LockService>();
  });

  afterEach(() => {
    sut.dispose();
    jest.useRealTimers();
  });

  describe("interval check", () => {
    it("does not check timeouts while the flag is disabled", () => {
      sut = buildSut(false);
      sut.init();

      jest.advanceTimersByTime(1_000);

      expect(vaultTimeoutService.checkVaultTimeout).not.toHaveBeenCalled();
    });

    it("checks timeouts while the flag is enabled", () => {
      sut = buildSut(true);
      sut.init();

      jest.advanceTimersByTime(1_000);

      expect(vaultTimeoutService.checkVaultTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe("logoutOnTimeout", () => {
    it("is false when the flag is disabled", () => {
      sut = buildSut(false);
      sut.init();

      expect(sut.logoutOnTimeout).toBe(false);
    });

    it("is false when every account locks on timeout", () => {
      sut = buildSut(true);
      sut.init();

      expect(sut.logoutOnTimeout).toBe(false);
    });

    it("is true when any account logs out on timeout", () => {
      settings.getVaultTimeoutActionByUserId$.mockImplementation((userId) =>
        of(userId === userB ? VaultTimeoutAction.LogOut : VaultTimeoutAction.Lock),
      );

      sut = buildSut(true);
      sut.init();

      expect(sut.logoutOnTimeout).toBe(true);
    });

    it("is false without accounts", () => {
      accounts$.next({});

      sut = buildSut(true);
      sut.init();

      expect(sut.logoutOnTimeout).toBe(false);
    });
  });

  describe("onSystemEvent", () => {
    beforeEach(() => {
      settings.getVaultTimeoutByUserId$.mockImplementation((userId) =>
        of(userId === userA ? VaultTimeoutStringType.OnSleep : VaultTimeoutStringType.OnLocked),
      );
    });

    it("does nothing while the flag is disabled", async () => {
      sut = buildSut(false);

      await sut.onSystemEvent(VaultTimeoutStringType.OnSleep);

      expect(lockService.lock).not.toHaveBeenCalled();
    });

    it("locks only accounts whose timeout matches the event", async () => {
      sut = buildSut(true);

      await sut.onSystemEvent(VaultTimeoutStringType.OnSleep);

      expect(lockService.lock).toHaveBeenCalledTimes(1);
      expect(lockService.lock).toHaveBeenCalledWith(userA, LockSource.VaultTimeout);
    });

    it("skips accounts whose timeout is suppressed by shared unlock", async () => {
      sut = buildSut(true);
      settings.isVaultTimeoutSuppressed.mockResolvedValue(true);

      await sut.onSystemEvent(VaultTimeoutStringType.OnSleep);

      expect(lockService.lock).not.toHaveBeenCalled();
    });
  });
});
