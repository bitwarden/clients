import { mock, mockReset } from "jest-mock-extended";
import * as rxjs from "rxjs";
import { of } from "rxjs";

import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
  const mockDialogService = mock<DialogService>();
  const mockDialogOpen = jest.spyOn(UnifiedUpgradeDialogComponent, "open");

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
      mockDialogService,
    );
  }

  const mockAccount: Account = {
    id: "test-user-id",
  } as Account;
  const accountSubject = new rxjs.BehaviorSubject(mockAccount);

  describe("initialization", () => {
    beforeEach(() => {
      setupTestService();
    });
    it("should be created", () => {
      expect(sut).toBeTruthy();
    });

    it("should subscribe to account and feature flag observables on construction", () => {
      expect(mockConfigService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.PM24996_ImplementUpgradeFromFreeDialog,
      );
    });
  });

  describe("displayUpgradePromptConditionally", () => {
    beforeEach(async () => {
      mockAccountService.activeAccount$ = accountSubject.asObservable();
      mockDialogOpen.mockReset();
      mockReset(mockConfigService);
      mockReset(mockBillingService);
      mockReset(mockVaultProfileService);
    });
    it("should not show dialog when feature flag is disabled", async () => {
      // Arrange
      mockConfigService.getFeatureFlag$.mockReturnValue(of(false));
      setupTestService();
      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toBeNull();
    });

    it("should not show dialog when user has premium", async () => {
      // Arrange
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(true));
      setupTestService();

      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toBeNull();
    });

    it("should not show dialog when profile is older than 5 minutes", async () => {
      // Arrange
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      const oldDate = new Date();
      oldDate.setMinutes(oldDate.getMinutes() - 10); // 10 minutes old
      mockVaultProfileService.getProfileCreationDate.mockResolvedValue(oldDate);
      setupTestService();

      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toBeNull();
    });

    it("should show dialog when all conditions are met", async () => {
      //Arrange
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      const recentDate = new Date();
      recentDate.setMinutes(recentDate.getMinutes() - 3); // 3 minutes old
      mockVaultProfileService.getProfileCreationDate.mockResolvedValue(recentDate);

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
    });

    it("should not show dialog when profile creation date is unavailable", async () => {
      // Arrange
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockBillingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      mockVaultProfileService.getProfileCreationDate.mockResolvedValue(null);
      setupTestService();

      // Act
      const result = await sut.displayUpgradePromptConditionally();

      // Assert
      expect(result).toBeNull();
    });
  });
});
