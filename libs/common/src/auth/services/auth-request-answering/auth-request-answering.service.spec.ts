import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthServerNotificationTags } from "@bitwarden/common/auth/enums/auth-server-notification-tags";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ActionsService } from "@bitwarden/common/platform/actions";
import {
  ButtonLocation,
  SystemNotificationEvent,
  SystemNotificationsService,
} from "@bitwarden/common/platform/system-notifications/system-notifications.service";
import { UserId } from "@bitwarden/user-core";

import { AuthRequestAnsweringService } from "./auth-request-answering.service";

describe("AuthRequestAnsweringService", () => {
  let accountService: MockProxy<AccountService>;
  let actionService: MockProxy<ActionsService>;
  let authService: MockProxy<AuthService>;
  let i18nService: MockProxy<I18nService>;
  let masterPasswordService: any; // MasterPasswordServiceAbstraction has many members; we only use forceSetPasswordReason$
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let systemNotificationsService: MockProxy<SystemNotificationsService>;

  let sut: AuthRequestAnsweringService;

  const userId = "9f4c3452-6a45-48af-a7d0-74d3e8b65e4c" as UserId;

  beforeEach(() => {
    accountService = mock<AccountService>();
    actionService = mock<ActionsService>();
    authService = mock<AuthService>();
    i18nService = mock<I18nService>();
    masterPasswordService = { forceSetPasswordReason$: jest.fn() };
    platformUtilsService = mock<PlatformUtilsService>();
    systemNotificationsService = mock<SystemNotificationsService>();

    // Common defaults
    authService.activeAccountStatus$ = of(AuthenticationStatus.Locked);
    accountService.activeAccount$ = of({
      id: userId,
      email: "user@example.com",
      emailVerified: true,
      name: "User",
    });
    accountService.accounts$ = of({
      [userId]: { email: "user@example.com", emailVerified: true, name: "User" },
    });
    (masterPasswordService.forceSetPasswordReason$ as jest.Mock).mockReturnValue(
      of(ForceSetPasswordReason.None),
    );
    platformUtilsService.isPopupOpen.mockResolvedValue(false);
    i18nService.t.mockImplementation(
      (key: string, p1?: any) => `${key}${p1 != null ? ":" + p1 : ""}`,
    );
    systemNotificationsService.create.mockResolvedValue("notif-id");

    sut = new AuthRequestAnsweringService(
      accountService,
      actionService,
      authService,
      i18nService,
      masterPasswordService,
      platformUtilsService,
      systemNotificationsService,
    );
  });

  describe("handleAuthRequestNotificationClicked", () => {
    it("clears notification and opens popup when notification body is clicked", async () => {
      const event: SystemNotificationEvent = {
        id: "123",
        buttonIdentifier: ButtonLocation.NotificationButton,
      };

      await sut.handleAuthRequestNotificationClicked(event);

      expect(systemNotificationsService.clear).toHaveBeenCalledWith({ id: "123" });
      expect(actionService.openPopup).toHaveBeenCalledTimes(1);
    });

    it("does nothing when an optional button is clicked", async () => {
      const event: SystemNotificationEvent = {
        id: "123",
        buttonIdentifier: ButtonLocation.FirstOptionalButton,
      };

      await sut.handleAuthRequestNotificationClicked(event);

      expect(systemNotificationsService.clear).not.toHaveBeenCalled();
      expect(actionService.openPopup).not.toHaveBeenCalled();
    });
  });

  describe("receivedPendingAuthRequest", () => {
    const authRequestId = "req-abc";

    it("creates a system notification when popup is not open", async () => {
      platformUtilsService.isPopupOpen.mockResolvedValue(false);
      authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

      await sut.receivedPendingAuthRequest(userId, authRequestId);

      expect(i18nService.t).toHaveBeenCalledWith("accountAccessRequested");
      expect(i18nService.t).toHaveBeenCalledWith("confirmAccessAttempt", "user@example.com");
      expect(systemNotificationsService.create).toHaveBeenCalledWith({
        id: `${AuthServerNotificationTags.AuthRequest}_${authRequestId}`,
        title: "accountAccessRequested",
        body: "confirmAccessAttempt:user@example.com",
        buttons: [],
      });
    });

    it("does not create a notification when popup is open, user is active, unlocked, and no force set password", async () => {
      platformUtilsService.isPopupOpen.mockResolvedValue(true);
      authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);
      (masterPasswordService.forceSetPasswordReason$ as jest.Mock).mockReturnValue(
        of(ForceSetPasswordReason.None),
      );

      await sut.receivedPendingAuthRequest(userId, authRequestId);

      expect(systemNotificationsService.create).not.toHaveBeenCalled();
    });
  });
});
