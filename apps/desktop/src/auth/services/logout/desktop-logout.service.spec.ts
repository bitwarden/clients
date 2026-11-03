import { Router } from "@angular/router";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { AccountSwitcherService } from "@bitwarden/common/auth/account-switcher";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EventUploadService } from "@bitwarden/common/dirt/event-logs";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/process-reload";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { StateEventRunnerService } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { BiometricStateService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { DesktopLogoutService } from "./desktop-logout.service";

describe("DesktopLogoutService", () => {
  const activeUserId = "active-user" as UserId;
  const backgroundUserId = "background-user" as UserId;
  const nextUserId = "next-user" as UserId;

  let logService: MockProxy<LogService>;
  let i18nService: MockProxy<I18nService>;
  let toastService: MockProxy<ToastService>;
  let dialogService: MockProxy<DialogService>;
  let accountService: MockProxy<AccountService>;
  let accountSwitcherService: MockProxy<AccountSwitcherService>;
  let authService: MockProxy<AuthService>;
  let eventUploadService: MockProxy<EventUploadService>;
  let cipherService: MockProxy<CipherService>;
  let folderService: MockProxy<InternalFolderService>;
  let biometricStateService: MockProxy<BiometricStateService>;
  let pinService: MockProxy<PinServiceAbstraction>;
  let keyService: MockProxy<KeyService>;
  let stateEventRunnerService: MockProxy<StateEventRunnerService>;
  let stateService: MockProxy<StateService>;
  let tokenService: MockProxy<TokenService>;
  let messagingService: MockProxy<MessagingService>;
  let router: MockProxy<Router>;
  let processReloadService: MockProxy<ProcessReloadServiceAbstraction>;

  let sut: DesktopLogoutService;

  beforeEach(() => {
    logService = mock<LogService>();
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);
    toastService = mock<ToastService>();
    dialogService = mock<DialogService>();
    accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: activeUserId } as any);
    accountSwitcherService = mock<AccountSwitcherService>();
    accountSwitcherService.nextSwitchableAccount$ = of({ id: nextUserId } as any);
    authService = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.LoggedOut));
    eventUploadService = mock<EventUploadService>();
    cipherService = mock<CipherService>();
    folderService = mock<InternalFolderService>();
    biometricStateService = mock<BiometricStateService>();
    pinService = mock<PinServiceAbstraction>();
    keyService = mock<KeyService>();
    stateEventRunnerService = mock<StateEventRunnerService>();
    stateService = mock<StateService>();
    tokenService = mock<TokenService>();
    messagingService = mock<MessagingService>();
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);
    processReloadService = mock<ProcessReloadServiceAbstraction>();

    sut = new DesktopLogoutService(
      logService,
      i18nService,
      toastService,
      dialogService,
      accountService,
      accountSwitcherService,
      authService,
      eventUploadService,
      cipherService,
      folderService,
      biometricStateService,
      pinService,
      keyService,
      stateEventRunnerService,
      stateService,
      tokenService,
      messagingService,
      router,
      processReloadService,
    );
  });

  it("logs the user id and reason", async () => {
    await sut.logout(activeUserId, "userInitiated");

    expect(logService.info).toHaveBeenCalledWith(
      "Logging out user %s for reason: %s",
      activeUserId,
      "userInitiated",
    );
  });

  it("clears the user's data, then tells the auth service to log out", async () => {
    await sut.logout(backgroundUserId, "userInitiated");

    expect(eventUploadService.uploadEvents).toHaveBeenCalledWith(backgroundUserId);
    expect(cipherService.clear).toHaveBeenCalledWith(backgroundUserId);
    expect(folderService.clear).toHaveBeenCalledWith(backgroundUserId);
    expect(biometricStateService.logout).toHaveBeenCalledWith(backgroundUserId);
    expect(pinService.logout).toHaveBeenCalledWith(backgroundUserId);
    expect(keyService.clearKeys).toHaveBeenCalledWith(backgroundUserId);
    expect(stateEventRunnerService.handleEvent).toHaveBeenCalledWith("logout", backgroundUserId);
    expect(stateService.clean).toHaveBeenCalledWith({ userId: backgroundUserId });
    expect(tokenService.clearTokens).toHaveBeenCalledWith(backgroundUserId);
    expect(accountService.clean).toHaveBeenCalledWith(backgroundUserId);
    expect(authService.logOut).toHaveBeenCalledWith(expect.any(Function), backgroundUserId);
  });

  it("reloads the process when the auth service runs its logout callback", async () => {
    await sut.logout(activeUserId, "userInitiated");
    expect(processReloadService.reloadProcess).not.toHaveBeenCalled();

    const callback = authService.logOut.mock.calls[0][0] as () => Promise<void>;
    await callback();

    expect(processReloadService.reloadProcess).toHaveBeenCalled();
  });

  it("returns undefined", async () => {
    const result = await sut.logout(activeUserId, "userInitiated");

    expect(result).toBeUndefined();
  });

  describe("account switching", () => {
    it("switches to the next switchable account when the active account logs out", async () => {
      await sut.logout(activeUserId, "userInitiated");

      expect(messagingService.send).toHaveBeenCalledWith("switchAccount", { userId: nextUserId });
      expect(accountService.switchAccount).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("does not switch accounts when a background account logs out", async () => {
      await sut.logout(backgroundUserId, "userInitiated");

      expect(messagingService.send).not.toHaveBeenCalledWith("switchAccount", expect.anything());
      expect(accountService.switchAccount).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("clears the active account and navigates to login when no account is switchable", async () => {
      accountSwitcherService.nextSwitchableAccount$ = of(null);

      await sut.logout(activeUserId, "userInitiated");

      expect(accountService.switchAccount).toHaveBeenCalledWith(null);
      expect(router.navigate).toHaveBeenCalledWith(["login"]);
    });
  });

  describe("isLoggingOut", () => {
    it("is true while the user's data is cleared and false after", async () => {
      let duringClear: boolean | undefined;
      cipherService.clear.mockImplementation(async () => {
        duringClear = sut.isLoggingOut(backgroundUserId);
      });

      await sut.logout(backgroundUserId, "userInitiated");

      expect(duringClear).toBe(true);
      expect(sut.isLoggingOut(backgroundUserId)).toBe(false);
    });

    it("is false again when clearing the user's data fails", async () => {
      cipherService.clear.mockRejectedValue(new Error("clear failed"));

      await expect(sut.logout(backgroundUserId, "userInitiated")).rejects.toThrow("clear failed");

      expect(sut.isLoggingOut(backgroundUserId)).toBe(false);
    });
  });

  describe("activeUserLoggingOut", () => {
    it("is true while the active user logs out and false after", async () => {
      let duringClear: boolean | undefined;
      cipherService.clear.mockImplementation(async () => {
        duringClear = sut.activeUserLoggingOut();
      });

      await sut.logout(activeUserId, "userInitiated");

      expect(duringClear).toBe(true);
      expect(sut.activeUserLoggingOut()).toBe(false);
    });

    it("stays false while a background account logs out", async () => {
      let duringClear: boolean | undefined;
      cipherService.clear.mockImplementation(async () => {
        duringClear = sut.activeUserLoggingOut();
      });

      await sut.logout(backgroundUserId, "userInitiated");

      expect(duringClear).toBe(false);
    });
  });

  describe("logout reason display", () => {
    it.each(["sessionExpired", "invalidSecurityStamp"] as const)(
      "shows a login expired toast for %s",
      async (logoutReason) => {
        await sut.logout(activeUserId, logoutReason);

        expect(toastService.showToast).toHaveBeenCalledWith({
          variant: "warning",
          title: "loggedOut",
          message: "loginExpired",
        });
      },
    );

    it.each([
      "accessTokenUnableToBeDecrypted",
      "refreshTokenSecureStorageRetrievalFailure",
    ] as const)(
      "shows a dialog for %s and waits for it to close before clearing data",
      async (logoutReason) => {
        const dialogRef = mock<DialogRef<boolean>>();
        dialogRef.closed = of(true);
        dialogService.openSimpleDialogRef.mockReturnValue(dialogRef);

        await sut.logout(activeUserId, logoutReason);

        expect(dialogService.openSimpleDialogRef).toHaveBeenCalledWith(
          expect.objectContaining({ content: { key: logoutReason }, type: "danger" }),
        );
        expect(toastService.showToast).not.toHaveBeenCalled();
      },
    );

    it("shows nothing for a user-initiated logout", async () => {
      await sut.logout(activeUserId, "userInitiated");

      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(dialogService.openSimpleDialogRef).not.toHaveBeenCalled();
    });
  });
});
