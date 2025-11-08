import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { PendingAuthRequestsStateService } from "@bitwarden/common/auth/services/auth-request-answering/pending-auth-requests.state";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/user-core";

import { DesktopAuthRequestAnsweringService } from "./desktop-auth-request-answering.service";

describe("DesktopAuthRequestAnsweringService", () => {
  let accountService: MockProxy<AccountService>;
  let authService: MockProxy<AuthService>;
  let masterPasswordService: any; // MasterPasswordServiceAbstraction has many members; we only use forceSetPasswordReason$
  let messagingService: MockProxy<MessagingService>;
  let pendingAuthRequestsState: MockProxy<PendingAuthRequestsStateService>;
  let i18nService: MockProxy<I18nService>;

  let sut: DesktopAuthRequestAnsweringService;

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

    describe("given the user is Unlocked, active, and not required to set/change their master password", () => {
      describe("given the Desktop window is visible", () => {
        it("should send an 'openLoginApproval' message", async () => {
          // Arrange
          (global as any).ipc.platform.isWindowVisible.mockResolvedValue(true);
          authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

          // Act
          await sut.receivedPendingAuthRequest(userId, authRequestId);

          // Assert
          expect(messagingService.send).toHaveBeenCalledTimes(1);
          expect(messagingService.send).toHaveBeenCalledWith("openLoginApproval");
        });

        it("should NOT create a system notification", async () => {
          // Arrange
          (global as any).ipc.platform.isWindowVisible.mockResolvedValue(true);
          authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

          // Act
          await sut.receivedPendingAuthRequest(userId, authRequestId);

          // Assert
          expect((global as any).ipc.auth.loginRequest).not.toHaveBeenCalled();
        });
      });

      describe("given the Desktop window is NOT visible", () => {
        it("should STILL send an 'openLoginApproval' message", async () => {
          // Arrange
          (global as any).ipc.platform.isWindowVisible.mockResolvedValue(false);
          authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

          // Act
          await sut.receivedPendingAuthRequest(userId, authRequestId);

          // Assert
          expect(messagingService.send).toHaveBeenCalledTimes(1);
          expect(messagingService.send).toHaveBeenCalledWith("openLoginApproval");
        });

        it("should create a system notification", async () => {
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
      });
    });

    describe("given the user is Locked", () => {
      it("should NOT send an 'openLoginApproval' message", async () => {
        // Arrange
        (global as any).ipc.platform.isWindowVisible.mockResolvedValue(true);
        authService.activeAccountStatus$ = of(AuthenticationStatus.Locked);

        // Act
        await sut.receivedPendingAuthRequest(userId, authRequestId);

        // Assert
        expect(messagingService.send).not.toHaveBeenCalled();
      });

      it("should create a system notification", async () => {
        // Arrange
        (global as any).ipc.platform.isWindowVisible.mockResolvedValue(true);
        authService.activeAccountStatus$ = of(AuthenticationStatus.Locked);

        // Act
        await sut.receivedPendingAuthRequest(userId, authRequestId);

        // Assert
        expect((global as any).ipc.auth.loginRequest).toHaveBeenCalledWith(
          "accountAccessRequested",
          "confirmAccessAttempt:user@example.com",
          "close",
        );
      });
    });

    describe("given the user is NOT the active user", () => {
      it("should NOT send an 'openLoginApproval' message", async () => {
        // Arrange
        const differentUserId = "different-user-id" as UserId;
        (global as any).ipc.platform.isWindowVisible.mockResolvedValue(true);
        authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);
        accountService.activeAccount$ = of({
          id: differentUserId,
          email: "different@example.com",
          emailVerified: true,
          name: "Different User",
        });

        // Act
        await sut.receivedPendingAuthRequest(userId, authRequestId);

        // Assert
        expect(messagingService.send).not.toHaveBeenCalled();
      });

      it("should create a system notification", async () => {
        // Arrange
        const differentUserId = "different-user-id" as UserId;
        (global as any).ipc.platform.isWindowVisible.mockResolvedValue(true);
        authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);
        accountService.activeAccount$ = of({
          id: differentUserId,
          email: "different@example.com",
          emailVerified: true,
          name: "Different User",
        });

        // Act
        await sut.receivedPendingAuthRequest(userId, authRequestId);

        // Assert
        expect((global as any).ipc.auth.loginRequest).toHaveBeenCalledWith(
          "accountAccessRequested",
          "confirmAccessAttempt:user@example.com",
          "close",
        );
      });
    });

    describe("given the user is required to set/change their master password", () => {
      it("should NOT send an 'openLoginApproval' message", async () => {
        // Arrange
        (global as any).ipc.platform.isWindowVisible.mockResolvedValue(true);
        authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);
        masterPasswordService.forceSetPasswordReason$ = jest
          .fn()
          .mockReturnValue(of(ForceSetPasswordReason.WeakMasterPassword));

        // Act
        await sut.receivedPendingAuthRequest(userId, authRequestId);

        // Assert
        expect(messagingService.send).not.toHaveBeenCalled();
      });

      it("should create a system notification", async () => {
        // Arrange
        (global as any).ipc.platform.isWindowVisible.mockResolvedValue(true);
        authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);
        masterPasswordService.forceSetPasswordReason$ = jest
          .fn()
          .mockReturnValue(of(ForceSetPasswordReason.WeakMasterPassword));

        // Act
        await sut.receivedPendingAuthRequest(userId, authRequestId);

        // Assert
        expect((global as any).ipc.auth.loginRequest).toHaveBeenCalledWith(
          "accountAccessRequested",
          "confirmAccessAttempt:user@example.com",
          "close",
        );
      });
    });
  });
});
