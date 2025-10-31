import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthRequestAnsweringService } from "@bitwarden/common/auth/abstractions/auth-request-answering/auth-request-answering.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { PendingAuthRequestsStateService } from "@bitwarden/common/auth/services/auth-request-answering/pending-auth-requests.state";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import {
  ButtonLocation,
  SystemNotificationEvent,
} from "@bitwarden/common/platform/system-notifications/system-notifications.service";
import { UserId } from "@bitwarden/user-core";

import { DesktopAuthRequestAnsweringService } from "./desktop-auth-request-answering.service";

describe("DesktopAuthRequestAnsweringService", () => {
  let accountService: MockProxy<AccountService>;
  let authService: MockProxy<AuthService>;
  let masterPasswordService: any; // MasterPasswordServiceAbstraction has many members; we only use forceSetPasswordReason$
  let messagingService: MockProxy<MessagingService>;
  let pendingAuthRequestsState: MockProxy<PendingAuthRequestsStateService>;
  let i18nService: MockProxy<I18nService>;

  let sut: AuthRequestAnsweringService;

  const userId = "9f4c3452-6a45-48af-a7d0-74d3e8b65e4c" as UserId;
  const authRequestId = "auth-request-id-123";

  beforeEach(() => {
    (global as any).ipc = {
      platform: {
        isWindowVisible: jest.fn(),
      },
      auth: {
        loginRequest: jest.fn(),
      },
    };

    accountService = mock<AccountService>();
    authService = mock<AuthService>();
    masterPasswordService = {
      forceSetPasswordReason$: jest.fn().mockReturnValue(of(ForceSetPasswordReason.None)),
    };
    messagingService = mock<MessagingService>();
    pendingAuthRequestsState = mock<PendingAuthRequestsStateService>();
    i18nService = mock<I18nService>();

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
    (global as any).ipc.platform.isWindowVisible.mockResolvedValue(false);
    i18nService.t.mockImplementation(
      (key: string, p1?: any) => `${key}${p1 != null ? ":" + p1 : ""}`,
    );

    sut = new DesktopAuthRequestAnsweringService(
      accountService,
      authService,
      masterPasswordService,
      messagingService,
      pendingAuthRequestsState,
      i18nService,
    );
  });

  describe("receivedPendingAuthRequest()", () => {
    it("should add a pending marker for the user to state", async () => {
      // Act
      await sut.receivedPendingAuthRequest(userId, authRequestId);

      // Assert
      expect(pendingAuthRequestsState.add).toHaveBeenCalledTimes(1);
      expect(pendingAuthRequestsState.add).toHaveBeenCalledWith(userId);
    });

    it("should send an 'openLoginApproval' message if the desktop window is visible and the user is Unlocked, active, and not required to set/change their master password", async () => {
      // Arrange
      (global as any).ipc.platform.isWindowVisible.mockResolvedValue(true);
      authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

      // Act
      await sut.receivedPendingAuthRequest(userId, authRequestId);

      // Assert
      expect(messagingService.send).toHaveBeenCalledTimes(1);
      expect(messagingService.send).toHaveBeenCalledWith("openLoginApproval");
    });

    it("should not send an 'openLoginApproval' message if the desktop window is not visible", async () => {
      (global as any).ipc.platform.isWindowVisible.mockResolvedValue(false);
      authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

      // Act
      await sut.receivedPendingAuthRequest(userId, authRequestId);

      // Assert
      expect(messagingService.send).not.toHaveBeenCalled();
    });

    it("should create a system notification if the desktop window is not visible", async () => {
      // Arrange
      (global as any).ipc.platform.isWindowVisible.mockResolvedValue(false);
      authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

      // Act
      await sut.receivedPendingAuthRequest(userId, authRequestId);

      // Assert
      expect(i18nService.t).toHaveBeenCalledWith("accountAccessRequested");
      expect(i18nService.t).toHaveBeenCalledWith("confirmAccessAttempt", "user@example.com");
      expect(i18nService.t).toHaveBeenCalledWith("close");

      expect((global as any).ipc.auth.loginRequest).toHaveBeenCalledWith(
        "accountAccessRequested",
        "confirmAccessAttempt:user@example.com",
        "close",
      );
    });

    it("should not create a system notification if the desktop window is visible and the user is Unlocked, active, and not required to set/change their master password", async () => {
      // Arrange
      (global as any).ipc.platform.isWindowVisible.mockResolvedValue(true);
      authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

      // Act
      await sut.receivedPendingAuthRequest(userId, authRequestId);

      // Assert
      expect((global as any).ipc.auth.loginRequest).not.toHaveBeenCalled();
    });
  });

  describe("userMeetsConditionsToShowApprovalDialog()", () => {
    it("should return true if desktop window is visible and user is Unlocked, active, and not required to set/change their master password", async () => {
      // Arrange
      (global as any).ipc.platform.isWindowVisible.mockResolvedValue(true);
      authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

      // Act
      const result = await sut.userMeetsConditionsToShowApprovalDialog(userId);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false if desktop window is not visible", async () => {
      // Arrange
      (global as any).ipc.platform.isWindowVisible.mockResolvedValue(false);
      authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

      // Act
      const result = await sut.userMeetsConditionsToShowApprovalDialog(userId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("handleAuthRequestNotificationClicked()", () => {
    it("should throw an error", async () => {
      // Arrange
      const event: SystemNotificationEvent = {
        id: "123",
        buttonIdentifier: ButtonLocation.NotificationButton,
      };

      // Act
      const promise = sut.handleAuthRequestNotificationClicked(event);

      // Assert
      await expect(promise).rejects.toThrow(
        "handleAuthRequestNotificationClicked() not implemented for this client",
      );
    });
  });
});
