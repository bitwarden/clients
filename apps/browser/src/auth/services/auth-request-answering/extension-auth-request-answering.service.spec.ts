import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthRequestAnsweringService } from "@bitwarden/common/auth/abstractions/auth-request-answering/auth-request-answering.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthServerNotificationTags } from "@bitwarden/common/auth/enums/auth-server-notification-tags";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { PendingAuthRequestsStateService } from "@bitwarden/common/auth/services/auth-request-answering/pending-auth-requests.state";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ActionsService } from "@bitwarden/common/platform/actions";
import {
  ButtonLocation,
  SystemNotificationEvent,
  SystemNotificationsService,
} from "@bitwarden/common/platform/system-notifications/system-notifications.service";
import { UserId } from "@bitwarden/user-core";

import { ExtensionAuthRequestAnsweringService } from "./extension-auth-request-answering.service";

describe("ExtensionAuthRequestAnsweringService", () => {
  let accountService: MockProxy<AccountService>;
  let authService: MockProxy<AuthService>;
  let masterPasswordService: any; // MasterPasswordServiceAbstraction has many members; we only use forceSetPasswordReason$
  let messagingService: MockProxy<MessagingService>;
  let pendingAuthRequestsState: MockProxy<PendingAuthRequestsStateService>;
  let actionService: MockProxy<ActionsService>;
  let i18nService: MockProxy<I18nService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let systemNotificationsService: MockProxy<SystemNotificationsService>;

  let sut: AuthRequestAnsweringService;

  const userId = "9f4c3452-6a45-48af-a7d0-74d3e8b65e4c" as UserId;
  const authRequestId = "auth-request-id-123";

  beforeEach(() => {
    accountService = mock<AccountService>();
    authService = mock<AuthService>();
    masterPasswordService = {
      forceSetPasswordReason$: jest.fn().mockReturnValue(of(ForceSetPasswordReason.None)),
    };
    messagingService = mock<MessagingService>();
    pendingAuthRequestsState = mock<PendingAuthRequestsStateService>();
    actionService = mock<ActionsService>();
    i18nService = mock<I18nService>();
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
    platformUtilsService.isPopupOpen.mockResolvedValue(false);
    i18nService.t.mockImplementation(
      (key: string, p1?: any) => `${key}${p1 != null ? ":" + p1 : ""}`,
    );
    systemNotificationsService.create.mockResolvedValue("notif-id");

    sut = new ExtensionAuthRequestAnsweringService(
      accountService,
      authService,
      masterPasswordService,
      messagingService,
      pendingAuthRequestsState,
      actionService,
      i18nService,
      platformUtilsService,
      systemNotificationsService,
    );
  });

  describe("receivedPendingAuthRequest()", () => {
    it("should throw if authRequestId not given", async () => {
      // Act
      const promise = sut.receivedPendingAuthRequest(userId, undefined);

      // Assert
      await expect(promise).rejects.toThrow("authRequestId not found.");
    });

    it("should add a pending marker for the user to state", async () => {
      // Act
      await sut.receivedPendingAuthRequest(userId, authRequestId);

      // Assert
      expect(pendingAuthRequestsState.add).toHaveBeenCalledTimes(1);
      expect(pendingAuthRequestsState.add).toHaveBeenCalledWith(userId);
    });

    it("should send an 'openLoginApproval' message if the popup is open and the user is Unlocked, active, and not required to set/change their master password", async () => {
      // Arrange
      platformUtilsService.isPopupOpen.mockResolvedValue(true);
      authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

      // Act
      await sut.receivedPendingAuthRequest(userId, authRequestId);

      // Assert
      expect(messagingService.send).toHaveBeenCalledTimes(1);
      expect(messagingService.send).toHaveBeenCalledWith("openLoginApproval", {
        notificationId: authRequestId,
      });
    });

    it("should not send an 'openLoginApproval' message if the popup is closed", async () => {
      // Arrange
      platformUtilsService.isPopupOpen.mockResolvedValue(false);
      authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

      // Act
      await sut.receivedPendingAuthRequest(userId, authRequestId);

      // Assert
      expect(messagingService.send).not.toHaveBeenCalled();
    });

    it("should create a system notification if the popup is closed", async () => {
      // Arrange
      platformUtilsService.isPopupOpen.mockResolvedValue(false);
      authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

      // Act
      await sut.receivedPendingAuthRequest(userId, authRequestId);

      // Assert
      expect(i18nService.t).toHaveBeenCalledWith("accountAccessRequested");
      expect(i18nService.t).toHaveBeenCalledWith("confirmAccessAttempt", "user@example.com");
      expect(systemNotificationsService.create).toHaveBeenCalledWith({
        id: `${AuthServerNotificationTags.AuthRequest}_${authRequestId}`,
        title: "accountAccessRequested",
        body: "confirmAccessAttempt:user@example.com",
        buttons: [],
      });
    });

    it("should not create a system notification if the popup is open and the user is Unlocked, active, and not required to set/change their master password", async () => {
      // Arrange
      platformUtilsService.isPopupOpen.mockResolvedValue(true);
      authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

      // Act
      await sut.receivedPendingAuthRequest(userId, authRequestId);

      // Assert
      expect(systemNotificationsService.create).not.toHaveBeenCalled();
    });
  });

  describe("userMeetsConditionsToShowApprovalDialog()", () => {
    it("should return true if popup is open and user is Unlocked, active, and not required to set/change their master password", async () => {
      // Arrange
      platformUtilsService.isPopupOpen.mockResolvedValue(true);
      authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

      // Act
      const result = await sut.userMeetsConditionsToShowApprovalDialog(userId);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false if popup is closed", async () => {
      // Arrange
      platformUtilsService.isPopupOpen.mockResolvedValue(false);
      authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

      // Act
      const result = await sut.userMeetsConditionsToShowApprovalDialog(userId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("handleAuthRequestNotificationClicked()", () => {
    it("should clear notification and open popup when notification body is clicked", async () => {
      // Arrange
      const event: SystemNotificationEvent = {
        id: "123",
        buttonIdentifier: ButtonLocation.NotificationButton,
      };

      // Act
      await sut.handleAuthRequestNotificationClicked(event);

      // Assert
      expect(systemNotificationsService.clear).toHaveBeenCalledWith({ id: "123" });
      expect(actionService.openPopup).toHaveBeenCalledTimes(1);
    });

    it("should do nothing when an optional notification button is clicked", async () => {
      // Arrange
      const event: SystemNotificationEvent = {
        id: "123",
        buttonIdentifier: ButtonLocation.FirstOptionalButton,
      };

      // Act
      await sut.handleAuthRequestNotificationClicked(event);

      // Assert
      expect(systemNotificationsService.clear).not.toHaveBeenCalled();
      expect(actionService.openPopup).not.toHaveBeenCalled();
    });
  });
});
