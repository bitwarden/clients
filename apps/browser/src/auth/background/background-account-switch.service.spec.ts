import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SystemService } from "@bitwarden/common/platform/abstractions/system.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";

import { PopupViewCacheBackgroundService } from "../../platform/services/popup-view-cache-background.service";

import { BackgroundAccountSwitchService } from "./background-account-switch.service";
import { BackgroundRefresher } from "./background-refresher";

describe("BackgroundAccountSwitchService", () => {
  const userId = "user-1" as UserId;

  let activeAccount$: BehaviorSubject<Account | null>;
  let accountService: MockProxy<AccountService>;
  let authService: MockProxy<AuthService>;
  let messagingService: MockProxy<MessagingService>;
  let popupViewCacheBackgroundService: MockProxy<PopupViewCacheBackgroundService>;
  let systemService: MockProxy<SystemService>;
  let syncService: MockProxy<SyncService>;
  let backgroundRefresher: MockProxy<BackgroundRefresher>;

  let sut: BackgroundAccountSwitchService;

  beforeEach(() => {
    activeAccount$ = new BehaviorSubject<Account | null>({ id: "other-user" as UserId } as Account);
    accountService = mock<AccountService>();
    accountService.activeAccount$ = activeAccount$;
    accountService.switchAccount.mockImplementation(async (id) => {
      activeAccount$.next(id == null ? null : ({ id } as Account));
    });
    authService = mock<AuthService>();
    messagingService = mock<MessagingService>();
    popupViewCacheBackgroundService = mock<PopupViewCacheBackgroundService>();
    systemService = mock<SystemService>();
    syncService = mock<SyncService>();
    backgroundRefresher = mock<BackgroundRefresher>();

    sut = new BackgroundAccountSwitchService(
      accountService,
      authService,
      messagingService,
      popupViewCacheBackgroundService,
      systemService,
      syncService,
      backgroundRefresher,
    );
  });

  it("clears the popup view cache and switches the active account", async () => {
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);

    await sut.switchAccount(userId);

    expect(popupViewCacheBackgroundService.clearState).toHaveBeenCalled();
    expect(accountService.switchAccount).toHaveBeenCalledWith(userId);
  });

  it("refreshes the views and sends goHome when no account is left", async () => {
    await sut.switchAccount(null);

    expect(accountService.switchAccount).toHaveBeenCalledWith(null);
    expect(backgroundRefresher.refreshMenu).toHaveBeenCalled();
    expect(backgroundRefresher.updateOverlayCiphers).toHaveBeenCalled();
    expect(messagingService.send).toHaveBeenCalledWith("goHome");
    expect(messagingService.send).toHaveBeenCalledWith("switchAccountFinish", {
      userId: null,
      status: undefined,
    });
  });

  it("sends goHome when the next account is logged out", async () => {
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.LoggedOut);

    await sut.switchAccount(userId);

    expect(messagingService.send).toHaveBeenCalledWith("goHome");
    expect(syncService.fullSync).not.toHaveBeenCalled();
  });

  it("sends locked when the next account is locked", async () => {
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);

    await sut.switchAccount(userId);

    expect(messagingService.send).toHaveBeenCalledWith("locked", { userId });
    expect(syncService.fullSync).not.toHaveBeenCalled();
  });

  it("sends unlocked, refreshes the views, and syncs when the next account is unlocked", async () => {
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Unlocked);

    await sut.switchAccount(userId);

    expect(systemService.clearPendingClipboard).toHaveBeenCalled();
    expect(messagingService.send).toHaveBeenCalledWith("unlocked", { userId });
    expect(backgroundRefresher.refreshMenu).toHaveBeenCalled();
    expect(backgroundRefresher.updateOverlayCiphers).toHaveBeenCalled();
    expect(syncService.fullSync).toHaveBeenCalledWith(false);
  });

  it("sends switchAccountFinish with the next account's status", async () => {
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);

    await sut.switchAccount(userId);

    expect(messagingService.send).toHaveBeenCalledWith("switchAccountFinish", {
      userId,
      status: AuthenticationStatus.Locked,
    });
  });

  it("sends switchAccountFinish when the switch fails", async () => {
    accountService.switchAccount.mockRejectedValue(new Error("switch failed"));

    await expect(sut.switchAccount(userId)).rejects.toThrow("switch failed");

    expect(messagingService.send).toHaveBeenCalledWith("switchAccountFinish", {
      userId,
      status: undefined,
    });
  });
});
