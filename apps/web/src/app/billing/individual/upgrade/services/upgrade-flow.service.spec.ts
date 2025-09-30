import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";

import { BitwardenSubscriber } from "../../../types";
import { PersonalSubscriptionPricingTierIds } from "../../../types/subscription-pricing-tier";
import {
  UpgradeAccountDialogComponent,
  UpgradeAccountDialogResult,
  UpgradeAccountDialogStatus,
} from "../upgrade-account-dialog/upgrade-account-dialog.component";
import {
  UpgradePaymentDialogComponent,
  UpgradePaymentDialogResult,
  UpgradePaymentDialogStatus,
} from "../upgrade-payment-dialog/upgrade-payment-dialog.component";

import { UpgradeFlowResult, UpgradeFlowService } from "./upgrade-flow.service";

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
function mockDialogOpenMethod(component: any, ...refs: DialogRef<any>[]) {
  const spy = jest.spyOn(component, "open");
  refs.forEach((ref) => spy.mockReturnValueOnce(ref));
  return spy;
}

describe("UpgradeFlowService", () => {
  let sut: UpgradeFlowService;
  let dialogService: MockProxy<DialogService>;
  let accountService: MockProxy<AccountService>;
  let router: MockProxy<Router>;

  // Mock account
  const mockAccount: Account = {
    id: "user-id" as UserId,
    email: "test@example.com",
    name: "Test User",
    emailVerified: true,
  };

  // Mock subscriber
  const mockSubscriber: BitwardenSubscriber = {
    type: "account",
    data: mockAccount,
  };

  beforeEach(() => {
    dialogService = mock<DialogService>();
    accountService = mock<AccountService>();
    router = mock<Router>();

    // Setup account service to return mock account
    accountService.activeAccount$ = of(mockAccount);

    // Setup router to return resolved promises for navigation
    router.navigate.mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        UpgradeFlowService,
        { provide: DialogService, useValue: dialogService },
        { provide: AccountService, useValue: accountService },
        { provide: Router, useValue: router },
      ],
    });

    sut = TestBed.inject(UpgradeFlowService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("startUpgradeFlow", () => {
    it("should return cancelled when upgrade account dialog is closed", async () => {
      // Setup mock dialog references
      const upgradeAccountDialogRef = createMockDialogRef<UpgradeAccountDialogResult>({
        status: UpgradeAccountDialogStatus.Closed,
        plan: null,
      });

      // Added to verify no payment dialog is opened
      jest.spyOn(UpgradePaymentDialogComponent, "open");
      mockDialogOpenMethod(UpgradeAccountDialogComponent, upgradeAccountDialogRef);

      // Act
      const result = await sut.startUpgradeFlow();

      // Assert
      expect(result).toBe(UpgradeFlowResult.Cancelled);
      expect(UpgradeAccountDialogComponent.open).toHaveBeenCalledWith(dialogService, {
        data: {
          dialogTitleMessageOverride: undefined,
        },
      });
      expect(UpgradePaymentDialogComponent.open).not.toHaveBeenCalled();
    });

    it("should return upgraded result when premium payment is successful and navigate to premium subscription settings", async () => {
      // Arrange - Setup mock dialog references
      const mockUpgradeDialogRef = createMockDialogRef<UpgradeAccountDialogResult>({
        status: UpgradeAccountDialogStatus.ProceededToPayment,
        plan: PersonalSubscriptionPricingTierIds.Premium,
      });

      const mockPaymentDialogRef = createMockDialogRef<UpgradePaymentDialogResult>({
        status: UpgradePaymentDialogStatus.UpgradedToPremium,
        organizationId: null,
      });

      mockDialogOpenMethod(UpgradeAccountDialogComponent, mockUpgradeDialogRef);
      mockDialogOpenMethod(UpgradePaymentDialogComponent, mockPaymentDialogRef);

      // Act
      const result = await sut.startUpgradeFlow();

      // Assert
      expect(result).toBe(UpgradeFlowResult.Upgraded);
      expect(UpgradeAccountDialogComponent.open).toHaveBeenCalledWith(dialogService, {
        data: {
          dialogTitleMessageOverride: undefined,
        },
      });
      expect(UpgradePaymentDialogComponent.open).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({
          data: expect.objectContaining({
            plan: PersonalSubscriptionPricingTierIds.Premium,
            subscriber: mockSubscriber,
          }),
        }),
      );
      expect(router.navigate).toHaveBeenCalledWith(["/settings/subscription"]);
    });

    it("should return upgraded result when families payment is successful", async () => {
      // Arrange - Setup mock dialog references
      const mockUpgradeDialogRef = createMockDialogRef<UpgradeAccountDialogResult>({
        status: UpgradeAccountDialogStatus.ProceededToPayment,
        plan: PersonalSubscriptionPricingTierIds.Families,
      });

      const organizationId = "mock-org-id";
      const mockPaymentDialogRef = createMockDialogRef<UpgradePaymentDialogResult>({
        status: UpgradePaymentDialogStatus.UpgradedToFamilies,
        organizationId: organizationId,
      });

      mockDialogOpenMethod(UpgradeAccountDialogComponent, mockUpgradeDialogRef);
      mockDialogOpenMethod(UpgradePaymentDialogComponent, mockPaymentDialogRef);

      // Act
      const result = await sut.startUpgradeFlow();

      // Assert
      expect(result).toBe(UpgradeFlowResult.Upgraded);
      expect(UpgradeAccountDialogComponent.open).toHaveBeenCalledWith(dialogService, {
        data: {
          dialogTitleMessageOverride: undefined,
        },
      });
      expect(UpgradePaymentDialogComponent.open).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({
          data: expect.objectContaining({
            plan: PersonalSubscriptionPricingTierIds.Families,
            subscriber: mockSubscriber,
          }),
        }),
      );
      // Verify navigation occurs by default
      expect(router.navigate).toHaveBeenCalledWith([
        `/organizations/${organizationId}/billing/subscription`,
      ]);
    });

    it("should return to upgrade dialog when user clicks back in payment dialog", async () => {
      // Arrange - Setup mock dialog references for first cycle
      const mockUpgradeDialogRef = createMockDialogRef<UpgradeAccountDialogResult>({
        status: UpgradeAccountDialogStatus.ProceededToPayment,
        plan: PersonalSubscriptionPricingTierIds.Premium,
      });

      const mockPaymentDialogRef = createMockDialogRef<UpgradePaymentDialogResult>({
        status: UpgradePaymentDialogStatus.Back,
        organizationId: null,
      });

      // Setup mock dialog for second cycle (when user cancels)
      const mockSecondUpgradeDialogRef = createMockDialogRef<UpgradeAccountDialogResult>({
        status: UpgradeAccountDialogStatus.Closed,
        plan: null,
      });

      mockDialogOpenMethod(
        UpgradeAccountDialogComponent,
        mockUpgradeDialogRef,
        mockSecondUpgradeDialogRef,
      );

      mockDialogOpenMethod(UpgradePaymentDialogComponent, mockPaymentDialogRef);

      // Act
      const result = await sut.startUpgradeFlow();

      // Assert
      expect(result).toBe(UpgradeFlowResult.Cancelled);
      expect(UpgradeAccountDialogComponent.open).toHaveBeenCalledTimes(2);
      expect(UpgradePaymentDialogComponent.open).toHaveBeenCalledTimes(1);
      expect(UpgradeAccountDialogComponent.open).toHaveBeenNthCalledWith(1, dialogService, {
        data: {
          dialogTitleMessageOverride: undefined,
        },
      });
      expect(UpgradeAccountDialogComponent.open).toHaveBeenNthCalledWith(2, dialogService, {
        data: {
          dialogTitleMessageOverride: undefined,
        },
      });
      expect(UpgradePaymentDialogComponent.open).toHaveBeenNthCalledWith(1, dialogService, {
        data: {
          plan: PersonalSubscriptionPricingTierIds.Premium,
          subscriber: mockSubscriber,
        },
      });
    });

    it("should handle a successful upgrade flow with going back and forth", async () => {
      // Arrange - Setup mock dialog references for first cycle
      const mockUpgradeDialogRef = createMockDialogRef<UpgradeAccountDialogResult>({
        status: UpgradeAccountDialogStatus.ProceededToPayment,
        plan: PersonalSubscriptionPricingTierIds.Premium,
      });

      const mockPaymentDialogRef = createMockDialogRef<UpgradePaymentDialogResult>({
        status: UpgradePaymentDialogStatus.Back,
        organizationId: null,
      });

      // Setup mock dialog for second cycle (when user selects families plan)
      const mockSecondUpgradeDialogRef = createMockDialogRef<UpgradeAccountDialogResult>({
        status: UpgradeAccountDialogStatus.ProceededToPayment,
        plan: PersonalSubscriptionPricingTierIds.Families,
      });

      const mockSecondPaymentDialogRef = createMockDialogRef<UpgradePaymentDialogResult>({
        status: UpgradePaymentDialogStatus.UpgradedToFamilies,
        organizationId: "mock-org-id",
      });

      mockDialogOpenMethod(
        UpgradeAccountDialogComponent,
        mockUpgradeDialogRef,
        mockSecondUpgradeDialogRef,
      );

      mockDialogOpenMethod(
        UpgradePaymentDialogComponent,
        mockPaymentDialogRef,
        mockSecondPaymentDialogRef,
      );

      // Act
      const result = await sut.startUpgradeFlow();

      // Assert
      expect(result).toBe(UpgradeFlowResult.Upgraded);
      expect(UpgradeAccountDialogComponent.open).toHaveBeenCalledTimes(2);
      expect(UpgradePaymentDialogComponent.open).toHaveBeenCalledTimes(2);
      expect(UpgradeAccountDialogComponent.open).toHaveBeenNthCalledWith(1, dialogService, {
        data: {
          dialogTitleMessageOverride: undefined,
        },
      });
      expect(UpgradeAccountDialogComponent.open).toHaveBeenNthCalledWith(2, dialogService, {
        data: {
          dialogTitleMessageOverride: undefined,
        },
      });
      expect(UpgradePaymentDialogComponent.open).toHaveBeenNthCalledWith(1, dialogService, {
        data: {
          plan: PersonalSubscriptionPricingTierIds.Premium,
          subscriber: mockSubscriber,
        },
      });
      expect(UpgradePaymentDialogComponent.open).toHaveBeenNthCalledWith(2, dialogService, {
        data: {
          plan: PersonalSubscriptionPricingTierIds.Families,
          subscriber: mockSubscriber,
        },
      });
      expect(router.navigate).toHaveBeenCalledWith([
        `/organizations/mock-org-id/billing/subscription`,
      ]);
    });

    it("should return cancelled result if payment dialog is closed without a successful payment", async () => {
      // Setup mock dialog references
      const mockUpgradeDialogRef = createMockDialogRef<UpgradeAccountDialogResult>({
        status: UpgradeAccountDialogStatus.ProceededToPayment,
        plan: PersonalSubscriptionPricingTierIds.Premium,
      });

      const mockPaymentDialogRef = createMockDialogRef<UpgradePaymentDialogResult>(
        "cancelled" as any,
      );

      mockDialogOpenMethod(UpgradeAccountDialogComponent, mockUpgradeDialogRef);
      mockDialogOpenMethod(UpgradePaymentDialogComponent, mockPaymentDialogRef);

      // Act
      const result = await sut.startUpgradeFlow();

      // Assert
      expect(result).toBe(UpgradeFlowResult.Cancelled);
    });

    it("should throw error for missing account information", async () => {
      // Setup account service to return null
      accountService.activeAccount$ = of(null as any);

      // Expect error
      await expect(sut.startUpgradeFlow()).rejects.toThrow();
    });
    it("should return cancelled if upgrade dialog returns null result", async () => {
      // Setup mock dialog references
      const upgradeAccountDialogRef = createMockDialogRef<UpgradeAccountDialogResult>(null);

      // Added to verify no payment dialog is opened
      jest.spyOn(UpgradePaymentDialogComponent, "open");
      mockDialogOpenMethod(UpgradeAccountDialogComponent, upgradeAccountDialogRef);

      // Act
      const result = await sut.startUpgradeFlow();

      // Assert
      expect(result).toBe(UpgradeFlowResult.Cancelled);
      expect(UpgradeAccountDialogComponent.open).toHaveBeenCalledWith(dialogService, {
        data: {
          dialogTitleMessageOverride: undefined,
        },
      });
      expect(UpgradePaymentDialogComponent.open).not.toHaveBeenCalled();
    });

    it("should return cancelled if payment dialog returns null result", async () => {
      // Setup mock dialog references
      const mockUpgradeDialogRef = createMockDialogRef<UpgradeAccountDialogResult>({
        status: UpgradeAccountDialogStatus.ProceededToPayment,
        plan: PersonalSubscriptionPricingTierIds.Premium,
      });

      const mockPaymentDialogRef = createMockDialogRef<UpgradePaymentDialogResult>(null);

      mockDialogOpenMethod(UpgradeAccountDialogComponent, mockUpgradeDialogRef);
      mockDialogOpenMethod(UpgradePaymentDialogComponent, mockPaymentDialogRef);

      // Act
      const result = await sut.startUpgradeFlow();

      // Assert
      expect(result).toBe(UpgradeFlowResult.Cancelled);
      expect(UpgradeAccountDialogComponent.open).toHaveBeenCalledWith(dialogService, {
        data: {
          dialogTitleMessageOverride: undefined,
        },
      });
      expect(UpgradePaymentDialogComponent.open).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({
          data: expect.objectContaining({
            plan: PersonalSubscriptionPricingTierIds.Premium,
            subscriber: mockSubscriber,
          }),
        }),
      );
    });

    it("should not navigate when autoNavigate is false", async () => {
      // Arrange - Setup mock dialog references
      const mockUpgradeDialogRef = createMockDialogRef<UpgradeAccountDialogResult>({
        status: UpgradeAccountDialogStatus.ProceededToPayment,
        plan: PersonalSubscriptionPricingTierIds.Premium,
      });

      const mockPaymentDialogRef = createMockDialogRef<UpgradePaymentDialogResult>({
        status: UpgradePaymentDialogStatus.UpgradedToPremium,
        organizationId: null,
      });

      mockDialogOpenMethod(UpgradeAccountDialogComponent, mockUpgradeDialogRef);
      mockDialogOpenMethod(UpgradePaymentDialogComponent, mockPaymentDialogRef);

      // Reset router mock to ensure clean state
      router.navigate.mockReset();

      // Act
      const result = await sut.startUpgradeFlow(false);

      // Assert
      expect(result).toBe(UpgradeFlowResult.Upgraded);
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
