import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

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

  describe("setupUnlockListenersForProcessingAuthRequests()", () => {
    let destroy$: Subject<void>;
    let activeAccount$: BehaviorSubject<any>;
    let activeAccountStatus$: BehaviorSubject<AuthenticationStatus>;
    let authStatusForSubjects: Map<UserId, BehaviorSubject<AuthenticationStatus>>;
    let pendingRequestMarkers: PendingAuthUserMarker[];

    beforeEach(() => {
      destroy$ = new Subject<void>();
      activeAccount$ = new BehaviorSubject({
        id: userId,
        email: "user@example.com",
        emailVerified: true,
        name: "User",
      });
      activeAccountStatus$ = new BehaviorSubject(AuthenticationStatus.Locked);
      authStatusForSubjects = new Map();
      pendingRequestMarkers = [];

      accountService.activeAccount$ = activeAccount$;
      authService.activeAccountStatus$ = activeAccountStatus$;
      authService.authStatusFor$.mockImplementation((id: UserId) => {
        if (!authStatusForSubjects.has(id)) {
          authStatusForSubjects.set(id, new BehaviorSubject(AuthenticationStatus.Locked));
        }
        return authStatusForSubjects.get(id)!;
      });

      pendingAuthRequestsState.getAll$.mockReturnValue(of([]));
    });

    afterEach(() => {
      destroy$.next();
      destroy$.complete();
    });

    describe("active account switching", () => {
      it("should process pending auth requests when switching to an unlocked user", async () => {
        // Arrange
        authStatusForSubjects.set(otherUserId, new BehaviorSubject(AuthenticationStatus.Unlocked));
        pendingRequestMarkers = [{ userId: otherUserId, receivedAtMs: Date.now() }];
        pendingAuthRequestsState.getAll$.mockReturnValue(of(pendingRequestMarkers));

        // Act
        sut.setupUnlockListenersForProcessingAuthRequests(destroy$);

        // Simulate account switching to an Unlocked account
        activeAccount$.next({
          id: otherUserId,
          email: "other@example.com",
          emailVerified: true,
          name: "Other",
        });

        // Assert
        await new Promise((resolve) => setTimeout(resolve, 0)); // Allows observable chain to complete before assertion
        expect(messagingService.send).toHaveBeenCalledWith("openLoginApproval");
      });

      it("should NOT process pending auth requests when switching to a locked user", async () => {
        // Arrange
        authStatusForSubjects.set(otherUserId, new BehaviorSubject(AuthenticationStatus.Locked));
        pendingRequestMarkers = [{ userId: otherUserId, receivedAtMs: Date.now() }];
        pendingAuthRequestsState.getAll$.mockReturnValue(of(pendingRequestMarkers));

        // Act
        sut.setupUnlockListenersForProcessingAuthRequests(destroy$);
        activeAccount$.next({
          id: otherUserId,
          email: "other@example.com",
          emailVerified: true,
          name: "Other",
        });

        // Assert
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(messagingService.send).not.toHaveBeenCalled();
      });

      it("should NOT process pending auth requests when switching to a logged out user", async () => {
        // Arrange
        authStatusForSubjects.set(otherUserId, new BehaviorSubject(AuthenticationStatus.LoggedOut));
        pendingRequestMarkers = [{ userId: otherUserId, receivedAtMs: Date.now() }];
        pendingAuthRequestsState.getAll$.mockReturnValue(of(pendingRequestMarkers));

        // Act
        sut.setupUnlockListenersForProcessingAuthRequests(destroy$);
        activeAccount$.next({
          id: otherUserId,
          email: "other@example.com",
          emailVerified: true,
          name: "Other",
        });

        // Assert
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(messagingService.send).not.toHaveBeenCalled();
      });

      it("should NOT process pending auth requests when active account becomes null", async () => {
        // Arrange
        pendingRequestMarkers = [{ userId, receivedAtMs: Date.now() }];
        pendingAuthRequestsState.getAll$.mockReturnValue(of(pendingRequestMarkers));

        // Act
        sut.setupUnlockListenersForProcessingAuthRequests(destroy$);
        activeAccount$.next(null);

        // Assert
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(messagingService.send).not.toHaveBeenCalled();
      });

      it("should handle multiple user switches correctly", async () => {
        // Arrange
        const secondUserId = "second-user-id" as UserId;
        authStatusForSubjects.set(otherUserId, new BehaviorSubject(AuthenticationStatus.Unlocked));
        authStatusForSubjects.set(secondUserId, new BehaviorSubject(AuthenticationStatus.Locked));
        pendingRequestMarkers = [{ userId: otherUserId, receivedAtMs: Date.now() }];
        pendingAuthRequestsState.getAll$.mockReturnValue(of(pendingRequestMarkers));

        // Act
        sut.setupUnlockListenersForProcessingAuthRequests(destroy$);

        // Switch to unlocked user (should trigger)
        activeAccount$.next({
          id: otherUserId,
          email: "other@example.com",
          emailVerified: true,
          name: "Other",
        });
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Switch to locked user (should NOT trigger)
        activeAccount$.next({
          id: secondUserId,
          email: "second@example.com",
          emailVerified: true,
          name: "Second",
        });
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Assert
        expect(messagingService.send).toHaveBeenCalledTimes(1);
      });
    });

    describe("authentication status transitions", () => {
      it("should process pending auth requests when active account transitions to Unlocked", async () => {
        // Arrange
        activeAccountStatus$.next(AuthenticationStatus.Locked);
        pendingRequestMarkers = [{ userId, receivedAtMs: Date.now() }];
        pendingAuthRequestsState.getAll$.mockReturnValue(of(pendingRequestMarkers));

        // Act
        sut.setupUnlockListenersForProcessingAuthRequests(destroy$);
        activeAccountStatus$.next(AuthenticationStatus.Unlocked);

        // Assert
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(messagingService.send).toHaveBeenCalledWith("openLoginApproval");
      });

      it("should process pending auth requests when transitioning from LoggedOut to Unlocked", async () => {
        // Arrange
        activeAccountStatus$.next(AuthenticationStatus.LoggedOut);
        pendingRequestMarkers = [{ userId, receivedAtMs: Date.now() }];
        pendingAuthRequestsState.getAll$.mockReturnValue(of(pendingRequestMarkers));

        // Act
        sut.setupUnlockListenersForProcessingAuthRequests(destroy$);
        activeAccountStatus$.next(AuthenticationStatus.Unlocked);

        // Assert
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(messagingService.send).toHaveBeenCalledWith("openLoginApproval");
      });

      it("should NOT process pending auth requests when transitioning from Unlocked to Locked", async () => {
        // Arrange
        activeAccountStatus$.next(AuthenticationStatus.Unlocked);
        pendingRequestMarkers = [{ userId, receivedAtMs: Date.now() }];
        pendingAuthRequestsState.getAll$.mockReturnValue(of(pendingRequestMarkers));

        // Act
        sut.setupUnlockListenersForProcessingAuthRequests(destroy$);
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Clear any calls from the initial trigger (from null -> Unlocked)
        messagingService.send.mockClear();

        activeAccountStatus$.next(AuthenticationStatus.Locked);

        // Assert
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(messagingService.send).not.toHaveBeenCalled();
      });

      it("should NOT process pending auth requests when transitioning from Locked to LoggedOut", async () => {
        // Arrange
        activeAccountStatus$.next(AuthenticationStatus.Locked);
        pendingRequestMarkers = [{ userId, receivedAtMs: Date.now() }];
        pendingAuthRequestsState.getAll$.mockReturnValue(of(pendingRequestMarkers));

        // Act
        sut.setupUnlockListenersForProcessingAuthRequests(destroy$);
        activeAccountStatus$.next(AuthenticationStatus.LoggedOut);

        // Assert
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(messagingService.send).not.toHaveBeenCalled();
      });

      it("should NOT process pending auth requests when staying in Unlocked status", async () => {
        // Arrange
        activeAccountStatus$.next(AuthenticationStatus.Unlocked);
        pendingRequestMarkers = [{ userId, receivedAtMs: Date.now() }];
        pendingAuthRequestsState.getAll$.mockReturnValue(of(pendingRequestMarkers));

        // Act
        sut.setupUnlockListenersForProcessingAuthRequests(destroy$);
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Clear any calls from the initial trigger (from null -> Unlocked)
        messagingService.send.mockClear();

        activeAccountStatus$.next(AuthenticationStatus.Unlocked);

        // Assert
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(messagingService.send).not.toHaveBeenCalled();
      });

      it("should handle multiple status transitions correctly", async () => {
        // Arrange
        activeAccountStatus$.next(AuthenticationStatus.Locked);
        pendingRequestMarkers = [{ userId, receivedAtMs: Date.now() }];
        pendingAuthRequestsState.getAll$.mockReturnValue(of(pendingRequestMarkers));

        // Act
        sut.setupUnlockListenersForProcessingAuthRequests(destroy$);

        // Transition to Unlocked (should trigger)
        activeAccountStatus$.next(AuthenticationStatus.Unlocked);
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Transition to Locked (should NOT trigger)
        activeAccountStatus$.next(AuthenticationStatus.Locked);
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Transition back to Unlocked (should trigger again)
        activeAccountStatus$.next(AuthenticationStatus.Unlocked);
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Assert
        expect(messagingService.send).toHaveBeenCalledTimes(2);
        expect(messagingService.send).toHaveBeenCalledWith("openLoginApproval");
      });
    });

    describe("subscription cleanup", () => {
      it("should stop processing when destroy$ emits", async () => {
        // Arrange
        authStatusForSubjects.set(otherUserId, new BehaviorSubject(AuthenticationStatus.Unlocked));
        pendingRequestMarkers = [{ userId: otherUserId, receivedAtMs: Date.now() }];
        pendingAuthRequestsState.getAll$.mockReturnValue(of(pendingRequestMarkers));

        // Act
        sut.setupUnlockListenersForProcessingAuthRequests(destroy$);

        // Emit destroy signal
        destroy$.next();

        // Try to trigger processing after cleanup
        activeAccount$.next({
          id: otherUserId,
          email: "other@example.com",
          emailVerified: true,
          name: "Other",
        });
        activeAccountStatus$.next(AuthenticationStatus.Unlocked);

        // Assert
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(messagingService.send).not.toHaveBeenCalled();
      });
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
