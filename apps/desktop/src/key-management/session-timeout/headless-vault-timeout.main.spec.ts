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

jest.mock("../../main/window.main", () => ({ WindowMain: jest.fn() }));

import { WindowMain } from "../../main/window.main";

import { HeadlessVaultTimeoutMain } from "./headless-vault-timeout.main";

const userA = "user-a" as UserId;
const userB = "user-b" as UserId;

describe("HeadlessVaultTimeoutMain", () => {
  let windowMain: { rendererDestroyed: boolean };
  let vaultTimeoutService: MockProxy<VaultTimeoutService>;
  let settings: MockProxy<VaultTimeoutSettingsService>;
  let accountService: MockProxy<AccountService>;
  let lockService: MockProxy<LockService>;
  let accounts$: BehaviorSubject<Record<UserId, unknown>>;
  let sut: HeadlessVaultTimeoutMain;

  beforeEach(() => {
    jest.useFakeTimers();

    windowMain = { rendererDestroyed: false };
    vaultTimeoutService = mock<VaultTimeoutService>();
    vaultTimeoutService.checkVaultTimeout.mockResolvedValue();
    settings = mock<VaultTimeoutSettingsService>();
    settings.isVaultTimeoutSuppressed.mockResolvedValue(false);
    settings.getVaultTimeoutActionByUserId$.mockReturnValue(of(VaultTimeoutAction.Lock));
    accounts$ = new BehaviorSubject<Record<UserId, unknown>>({ [userA]: {}, [userB]: {} });
    accountService = mock<AccountService>();
    Object.assign(accountService, { accounts$ });
    lockService = mock<LockService>();

    sut = new HeadlessVaultTimeoutMain(
      windowMain as unknown as WindowMain,
      vaultTimeoutService,
      settings,
      accountService,
      lockService,
      mock<LogService>(),
    );
  });

  afterEach(() => {
    sut.dispose();
    jest.useRealTimers();
  });

  describe("interval check", () => {
    it("leaves timeout checks to the renderer while it exists", () => {
      sut.init();

      jest.advanceTimersByTime(10_000);

      expect(vaultTimeoutService.checkVaultTimeout).not.toHaveBeenCalled();
    });

    it("checks timeouts while the renderer is destroyed", () => {
      windowMain.rendererDestroyed = true;
      sut.init();

      jest.advanceTimersByTime(10_000);

      expect(vaultTimeoutService.checkVaultTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe("logoutOnTimeout", () => {
    it("is false when every account locks on timeout", () => {
      sut.init();

      expect(sut.logoutOnTimeout).toBe(false);
    });

    it("is true when any account logs out on timeout", () => {
      settings.getVaultTimeoutActionByUserId$.mockImplementation((userId) =>
        of(userId === userB ? VaultTimeoutAction.LogOut : VaultTimeoutAction.Lock),
      );

      sut.init();

      expect(sut.logoutOnTimeout).toBe(true);
    });

    it("is false without accounts", () => {
      accounts$.next({});

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

    it("leaves system events to the renderer while it exists", async () => {
      await sut.onSystemEvent(VaultTimeoutStringType.OnSleep);

      expect(lockService.lock).not.toHaveBeenCalled();
    });

    it("locks only accounts whose timeout matches the event", async () => {
      windowMain.rendererDestroyed = true;

      await sut.onSystemEvent(VaultTimeoutStringType.OnSleep);

      expect(lockService.lock).toHaveBeenCalledTimes(1);
      expect(lockService.lock).toHaveBeenCalledWith(userA, LockSource.VaultTimeout);
    });

    it("skips accounts whose timeout is suppressed by shared unlock", async () => {
      windowMain.rendererDestroyed = true;
      settings.isVaultTimeoutSuppressed.mockResolvedValue(true);

      await sut.onSystemEvent(VaultTimeoutStringType.OnSleep);

      expect(lockService.lock).not.toHaveBeenCalled();
    });
  });
});
