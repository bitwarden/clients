import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import {
  ButtonLocation,
  SystemNotificationEvent,
} from "@bitwarden/common/platform/system-notifications/system-notifications.service";
import { UserId } from "@bitwarden/user-core";

import { AuthRequestAnsweringService } from "../../abstractions/auth-request-answering/auth-request-answering.service.abstraction";

import { DefaultAuthRequestAnsweringService } from "./default-auth-request-answering.service";
import {
  PendingAuthRequestsStateService,
  PendingAuthUserMarker,
} from "./pending-auth-requests.state";

describe("DefaultAuthRequestAnsweringService", () => {
  let accountService: MockProxy<AccountService>;
  let authService: MockProxy<AuthService>;
  let masterPasswordService: any; // MasterPasswordServiceAbstraction has many members; we only use forceSetPasswordReason$
  let messagingService: MockProxy<MessagingService>;
  let pendingAuthRequestsState: MockProxy<PendingAuthRequestsStateService>;

  let sut: AuthRequestAnsweringService;

  const userId = "9f4c3452-6a45-48af-a7d0-74d3e8b65e4c" as UserId;
  const otherUserId = "554c3112-9a75-23af-ab80-8dk3e9bl5i8e" as UserId;

  beforeEach(() => {
    accountService = mock<AccountService>();
    authService = mock<AuthService>();
    masterPasswordService = {
      forceSetPasswordReason$: jest.fn().mockReturnValue(of(ForceSetPasswordReason.None)),
    };
    messagingService = mock<MessagingService>();
    pendingAuthRequestsState = mock<PendingAuthRequestsStateService>();

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

    sut = new DefaultAuthRequestAnsweringService(
      accountService,
      authService,
      masterPasswordService,
      messagingService,
      pendingAuthRequestsState,
    );
  });

  describe("receivedPendingAuthRequest()", () => {
    it("should throw an error", async () => {
      // Act
      const promise = sut.receivedPendingAuthRequest(userId);

      // Assert
      await expect(promise).rejects.toThrow(
        "receivedPendingAuthRequest() not implemented for this client",
      );
    });
  });

  describe("userMeetsConditionsToShowApprovalDialog()", () => {
    it("should return true if user is Unlocked, active, and not required to set/change their master password", async () => {
      // Arrange
      authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);

      // Act
      const result = await sut.userMeetsConditionsToShowApprovalDialog(userId);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false if user is not Unlocked", async () => {
      // Arrange
      authService.activeAccountStatus$ = of(AuthenticationStatus.Locked);

      // Act
      const result = await sut.userMeetsConditionsToShowApprovalDialog(userId);

      // Assert
      expect(result).toBe(false);
    });

    it("should return false if user is not the active user", async () => {
      // Arrange
      accountService.activeAccount$ = of({
        id: otherUserId,
        email: "other-user@example.com",
        emailVerified: true,
        name: "Other User",
      });

      // Act
      const result = await sut.userMeetsConditionsToShowApprovalDialog(userId);

      // Assert
      expect(result).toBe(false);
    });

    it("should return false if user is required to set/change their master password", async () => {
      // Arrange
      masterPasswordService.forceSetPasswordReason$.mockReturnValue(
        of(ForceSetPasswordReason.WeakMasterPassword),
      );

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

  describe("processPendingAuthRequests()", () => {
    it("should send an 'openLoginApproval' message if there is at least one pending auth request for the user in state", async () => {
      // Arrange
      const pendingRequests: PendingAuthUserMarker[] = [{ userId, receivedAtMs: Date.now() }];
      pendingAuthRequestsState.getAll$.mockReturnValue(of(pendingRequests));

      // Act
      await sut.processPendingAuthRequests();

      // Assert
      expect(messagingService.send).toHaveBeenCalledWith("openLoginApproval");
      expect(messagingService.send).toHaveBeenCalledTimes(1);
    });

    it("should NOT send a message if there are no pending auth requests in state", async () => {
      // Arrange
      const pendingRequests: PendingAuthUserMarker[] = [];
      pendingAuthRequestsState.getAll$.mockReturnValue(of(pendingRequests));

      // Act
      await sut.processPendingAuthRequests();

      // Assert
      expect(messagingService.send).not.toHaveBeenCalled();
    });

    it("should NOT send a message if there are no pending auth requests in state for the active user", async () => {
      // Arrange
      const pendingRequests: PendingAuthUserMarker[] = [
        { userId: otherUserId, receivedAtMs: Date.now() },
      ]; // pending auth marker for a different user
      pendingAuthRequestsState.getAll$.mockReturnValue(of(pendingRequests));

      // Act
      await sut.processPendingAuthRequests();

      // Assert
      expect(messagingService.send).not.toHaveBeenCalled();
    });
  });
});
