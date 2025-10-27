import { mock, mockReset } from "jest-mock-extended";
import { of, BehaviorSubject } from "rxjs";

import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync/sync.service";
import { DialogRef, DialogService } from "@bitwarden/components";

import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogStatus,
} from "../unified-upgrade-dialog/unified-upgrade-dialog.component";

import { UnifiedUpgradePromptService } from "./unified-upgrade-prompt.service";

describe("UnifiedUpgradePromptService", () => {
  let sut: UnifiedUpgradePromptService;
  const mockAccountService = mock<AccountService>();
  const mockConfigService = mock<ConfigService>();
  const mockBillingService = mock<BillingAccountProfileStateService>();
  const mockVaultProfileService = mock<VaultProfileService>();
  const mockSyncService = mock<SyncService>();
  const mockDialogService = mock<DialogService>();
  const mockOrganizationService = mock<OrganizationService>();
  const mockDialogOpen = jest.spyOn(UnifiedUpgradeDialogComponent, "open");
  const mockPlatformUtilsService = mock<PlatformUtilsService>();

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
      mockConfigService,
      mockBillingService,
      mockVaultProfileService,
      mockSyncService,
      mockDialogService,
      mockOrganizationService,
      mockPlatformUtilsService,
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
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));

      setupTestService();
    });
    it("should be created", () => {
      expect(sut).toBeTruthy();
    });
  });

  describe("displayUpgradePromptConditionally", () => {
    beforeEach(() => {
      mockAccountService.activeAccount$ = accountSubject.asObservable();
      mockDialogOpen.mockReset();
      mockReset(mockDialogService);
      mockReset(mockConfigService);
      mockReset(mockBillingService);
      mockReset(mockVaultProfileService);
      mockReset(mockSyncService);
      mockReset(mockOrganizationService);

      // Mock sync service methods
      mockSyncService.fullSync.mockResolvedValue(true);
      mockSyncService.lastSync$.mockReturnValue(of(new Date()));
      mockReset(mockPlatformUtilsService);
    });
    it("should subscribe to account and feature flag observables when checking display conditions", async () => {
      // Arrange
      mockPlatformUtilsService.isSelfHost.mockReturnValue(false);
      mockOrganizationService.memberOrganizations$.mockReturnValue(of([]));
      mockConfigService.getFeatureFlag$.mockReturnValue(of(false));
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));

      setupTestService();

      // Act
      await sut.displayUpgradePromptConditionally();

      // Assert
      expect(mockConfigService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.PM24996_ImplementUpgradeFromFreeDialog,
      );
      expect(mockAccountService.activeAccount$).toBeDefined();
    });
    it("should not show dialog when feature flag is disabled", async () => {
      // Arrange
      mockPlatformUtilsService.isSelfHost.mockReturnValue(false);
      mockOrganizationService.memberOrganizations$.mockReturnValue(of([]));
      mockConfigService.getFeatureFlag$.mockReturnValue(of(false));
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      const recentDate = new Date();
      recentDate.setMinutes(recentDate.getMinutes() - 3); // 3 minutes old
      mockVaultProfileService.getProfileCreationDate.mockResolvedValue(recentDate);

      setupTestService();
      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toBeNull();
      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should not show dialog when user has premium", async () => {
      // Arrange
      mockPlatformUtilsService.isSelfHost.mockReturnValue(false);
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
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
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      mockOrganizationService.memberOrganizations$.mockReturnValue(of([{ id: "org1" } as any]));
      mockPlatformUtilsService.isSelfHost.mockReturnValue(true);
      setupTestService();

      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toBeNull();
      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should not show dialog when profile is older than 5 minutes", async () => {
      // Arrange
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      mockOrganizationService.memberOrganizations$.mockReturnValue(of([]));
      const oldDate = new Date();
      oldDate.setMinutes(oldDate.getMinutes() - 10); // 10 minutes old
      mockVaultProfileService.getProfileCreationDate.mockResolvedValue(oldDate);
      mockPlatformUtilsService.isSelfHost.mockReturnValue(false);
      setupTestService();

      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toBeNull();
      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should show dialog when all conditions are met", async () => {
      //Arrange
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      mockOrganizationService.memberOrganizations$.mockReturnValue(of([]));
      const recentDate = new Date();
      recentDate.setMinutes(recentDate.getMinutes() - 3); // 3 minutes old
      mockVaultProfileService.getProfileCreationDate.mockResolvedValue(recentDate);
      mockPlatformUtilsService.isSelfHost.mockReturnValue(false);

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
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      accountSubject.next(null); // Set account to null
      setupTestService();

      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toBeNull();
      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should not show dialog when profile creation date is unavailable", async () => {
      // Arrange
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      mockOrganizationService.memberOrganizations$.mockReturnValue(of([]));
      mockVaultProfileService.getProfileCreationDate.mockResolvedValue(null);
      mockPlatformUtilsService.isSelfHost.mockReturnValue(false);

      setupTestService();

      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toBeNull();
      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("should not show dialog when running in self-hosted environment", async () => {
      // Arrange
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockOrganizationService.memberOrganizations$.mockReturnValue(of([]));
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      const recentDate = new Date();
      recentDate.setMinutes(recentDate.getMinutes() - 3); // 3 minutes old
      mockVaultProfileService.getProfileCreationDate.mockResolvedValue(recentDate);
      mockPlatformUtilsService.isSelfHost.mockReturnValue(true);
      setupTestService();

      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toBeNull();
      expect(mockDialogOpen).not.toHaveBeenCalled();
    });
  });
});
