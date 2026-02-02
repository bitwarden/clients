import { mock, mockReset } from "jest-mock-extended";
import { of, BehaviorSubject } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync/sync.service";
import { DialogRef, DialogService } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";

import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogStatus,
} from "../unified-upgrade-dialog/unified-upgrade-dialog.component";

import {
  UnifiedUpgradePromptService,
  PREMIUM_MODAL_DISMISSED_KEY,
  PREMIUM_MODAL_SESSION_COUNT_KEY,
} from "./unified-upgrade-prompt.service";

describe("UnifiedUpgradePromptService", () => {
  let sut: UnifiedUpgradePromptService;
  const mockAccountService = mock<AccountService>();
  const mockBillingService = mock<BillingAccountProfileStateService>();
  const mockSyncService = mock<SyncService>();
  const mockDialogService = mock<DialogService>();
  const mockOrganizationService = mock<OrganizationService>();
  const mockDialogOpen = jest.spyOn(UnifiedUpgradeDialogComponent, "open");
  const mockPlatformUtilsService = mock<PlatformUtilsService>();
  const mockStateProvider = mock<StateProvider>();
  const mockLogService = mock<LogService>();

  function mockUserStateValues({
    dismissed = false,
    sessionCount = 0,
  }: {
    dismissed?: boolean;
    sessionCount?: number;
  } = {}) {
    mockStateProvider.getUserState$.mockImplementation((key) => {
      if (key === PREMIUM_MODAL_DISMISSED_KEY) {
        return of(dismissed);
      }
      if (key === PREMIUM_MODAL_SESSION_COUNT_KEY) {
        return of(sessionCount);
      }
      return of(undefined as any);
    });
  }

  /**
   * Creates a mock DialogRef that implements the required properties for testing
   * @param result The result that will be emitted by the closed observable
   * @returns A mock DialogRef object
   */
  function createMockDialogRef<T>(result: T): DialogRef<T> {
    // Create a mock that implements the DialogRef interface
    return {
      // The closed property is readonly in the actual DialogRef
      closed: of(result),
    } as DialogRef<T>;
  }

  // Mock the open method of a dialog component to return the provided DialogRefs
  // Supports multiple calls by returning different refs in sequence
  function mockDialogOpenMethod(...refs: DialogRef<any>[]) {
    refs.forEach((ref) => mockDialogOpen.mockReturnValueOnce(ref));
  }

  function setupTestService() {
    sut = new UnifiedUpgradePromptService(
      mockAccountService,
      mockBillingService,
      mockSyncService,
      mockDialogService,
      mockOrganizationService,
      mockPlatformUtilsService,
      mockStateProvider,
      mockLogService,
    );
  }

  const mockAccount: Account = {
    id: "test-user-id",
  } as Account;
  const accountSubject = new BehaviorSubject<Account | null>(mockAccount);

  describe("initialization", () => {
    beforeEach(() => {
      mockAccountService.activeAccount$ = accountSubject.asObservable();
      mockPlatformUtilsService.isSelfHost.mockReturnValue(false);
      mockUserStateValues();

      setupTestService();
    });
    it("should be created", () => {
      expect(sut).toBeTruthy();
    });
  });

  describe("displayUpgradePromptConditionally", () => {
    beforeEach(() => {
      accountSubject.next(mockAccount); // Reset account to mockAccount
      mockAccountService.activeAccount$ = accountSubject.asObservable();
      mockDialogOpen.mockReset();
      mockReset(mockDialogService);
      mockReset(mockBillingService);
      mockReset(mockSyncService);
      mockReset(mockOrganizationService);
      mockReset(mockStateProvider);

      // Mock sync service methods
      mockSyncService.fullSync.mockResolvedValue(true);
      mockSyncService.lastSync$.mockReturnValue(of(new Date()));
      mockReset(mockPlatformUtilsService);

      // Default: modal has not been dismissed
      mockUserStateValues();
      mockStateProvider.setUserState.mockImplementation(async (_key, value, userId) => {
        return [userId ?? (mockAccount.id as any), value] as any;
      });

      // Clear session markers between tests
      try {
        window.sessionStorage?.clear();
      } catch {
        // ignore
      }
    });
    it("should subscribe to account observables when checking display conditions", async () => {
      // Arrange
      mockPlatformUtilsService.isSelfHost.mockReturnValue(false);
      mockOrganizationService.memberOrganizations$.mockReturnValue(of([]));
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));

      setupTestService();

      // Act
      await sut.displayUpgradePromptConditionally();

      // Assert
      expect(mockAccountService.activeAccount$).toBeDefined();
    });

    it("should not show dialog when user has premium", async () => {
      // Arrange
      mockPlatformUtilsService.isSelfHost.mockReturnValue(false);
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(true));
      mockOrganizationService.memberOrganizations$.mockReturnValue(of([]));
      setupTestService();

      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toBeNull();
      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should not show dialog when user has any organization membership", async () => {
      // Arrange
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      mockOrganizationService.memberOrganizations$.mockReturnValue(of([{ id: "org1" } as any]));
      mockPlatformUtilsService.isSelfHost.mockReturnValue(false);
      mockUserStateValues({ sessionCount: 5 });
      setupTestService();

      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toBeNull();
      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should not show dialog when user has fewer than 5 sessions", async () => {
      // Arrange
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      mockOrganizationService.memberOrganizations$.mockReturnValue(of([]));
      mockPlatformUtilsService.isSelfHost.mockReturnValue(false);
      mockUserStateValues({ sessionCount: 0 });
      setupTestService();

      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toBeNull();
      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should show dialog when user reaches 5 sessions", async () => {
      //Arrange
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      mockOrganizationService.memberOrganizations$.mockReturnValue(of([]));
      mockPlatformUtilsService.isSelfHost.mockReturnValue(false);

      // 4 prior sessions; this call should increment to 5
      mockUserStateValues({ sessionCount: 4 });

      const expectedResult = { status: UnifiedUpgradeDialogStatus.Closed };
      mockDialogOpenMethod(createMockDialogRef(expectedResult));
      setupTestService();

      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockDialogOpen).toHaveBeenCalled();
    });

    it("should not show dialog when account is null/undefined", async () => {
      // Arrange
      accountSubject.next(null); // Set account to null
      setupTestService();

      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toBeNull();
      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should not show dialog when running in self-hosted environment", async () => {
      // Arrange
      mockOrganizationService.memberOrganizations$.mockReturnValue(of([]));
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      mockPlatformUtilsService.isSelfHost.mockReturnValue(true);
      setupTestService();

      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toBeNull();
      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should not show dialog when user has previously dismissed the modal", async () => {
      // Arrange
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      mockOrganizationService.memberOrganizations$.mockReturnValue(of([]));
      mockPlatformUtilsService.isSelfHost.mockReturnValue(false);
      mockUserStateValues({ dismissed: true, sessionCount: 10 });
      setupTestService();

      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toBeNull();
      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should save dismissal state when user closes the dialog", async () => {
      // Arrange
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      mockOrganizationService.memberOrganizations$.mockReturnValue(of([]));
      mockPlatformUtilsService.isSelfHost.mockReturnValue(false);
      mockUserStateValues({ sessionCount: 5 });

      const expectedResult = { status: UnifiedUpgradeDialogStatus.Closed };
      mockDialogOpenMethod(createMockDialogRef(expectedResult));
      setupTestService();

      // Act
      await sut.displayUpgradePromptConditionally();

      // Assert
      expect(mockStateProvider.setUserState).toHaveBeenCalledWith(
        PREMIUM_MODAL_DISMISSED_KEY,
        true,
        mockAccount.id,
      );
    });

    it("should not save dismissal state when user upgrades to premium", async () => {
      // Arrange
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      mockOrganizationService.memberOrganizations$.mockReturnValue(of([]));
      mockPlatformUtilsService.isSelfHost.mockReturnValue(false);
      mockUserStateValues({ sessionCount: 5 });

      const expectedResult = { status: UnifiedUpgradeDialogStatus.UpgradedToPremium };
      mockDialogOpenMethod(createMockDialogRef(expectedResult));
      setupTestService();

      // Act
      await sut.displayUpgradePromptConditionally();

      // Assert
      expect(mockStateProvider.setUserState).not.toHaveBeenCalledWith(
        PREMIUM_MODAL_DISMISSED_KEY,
        true,
        mockAccount.id,
      );
    });
  });
});
