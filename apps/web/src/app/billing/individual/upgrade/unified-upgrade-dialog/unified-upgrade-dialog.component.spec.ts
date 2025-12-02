import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { PremiumInterestStateService } from "@bitwarden/angular/billing/services/premium-interest/premium-interest-state.service.abstraction";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import {
  PersonalSubscriptionPricingTierId,
  PersonalSubscriptionPricingTierIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import {
  UpgradeAccountComponent,
  UpgradeAccountStatus,
} from "../upgrade-account/upgrade-account.component";
import {
  UpgradePaymentComponent,
  UpgradePaymentResult,
} from "../upgrade-payment/upgrade-payment.component";

import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogParams,
  UnifiedUpgradeDialogStep,
} from "./unified-upgrade-dialog.component";

@Component({
  selector: "app-upgrade-account",
  template: "",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockUpgradeAccountComponent {
  readonly dialogTitleMessageOverride = input<string | null>(null);
  readonly hideContinueWithoutUpgradingButton = input<boolean>(false);
  planSelected = output<PersonalSubscriptionPricingTierId>();
  closeClicked = output<UpgradeAccountStatus>();
}

@Component({
  selector: "app-upgrade-payment",
  template: "",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockUpgradePaymentComponent {
  readonly selectedPlanId = input<PersonalSubscriptionPricingTierId | null>(null);
  readonly account = input<Account | null>(null);
  goBack = output<void>();
  complete = output<UpgradePaymentResult>();
}

describe("UnifiedUpgradeDialogComponent", () => {
  let component: UnifiedUpgradeDialogComponent;
  let fixture: ComponentFixture<UnifiedUpgradeDialogComponent>;
  const mockDialogRef = mock<DialogRef>();
  const mockRouter = mock<Router>();
  const mockPremiumInterestStateService = mock<PremiumInterestStateService>();

  const mockAccount: Account = {
    id: "user-id" as UserId,
    email: "test@example.com",
    emailVerified: true,
    name: "Test User",
  };

  const defaultDialogData: UnifiedUpgradeDialogParams = {
    account: mockAccount,
    initialStep: null,
    selectedPlan: null,
    planSelectionStepTitleOverride: null,
  };

  /**
   * Helper function to create and configure a fresh component instance with custom dialog data
   */
  async function createComponentWithDialogData(
    dialogData: UnifiedUpgradeDialogParams,
    waitForStable = false,
  ): Promise<{
    fixture: ComponentFixture<UnifiedUpgradeDialogComponent>;
    component: UnifiedUpgradeDialogComponent;
  }> {
    TestBed.resetTestingModule();
    jest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, UnifiedUpgradeDialogComponent],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DIALOG_DATA, useValue: dialogData },
        { provide: Router, useValue: mockRouter },
        { provide: PremiumInterestStateService, useValue: mockPremiumInterestStateService },
      ],
    })
      .overrideComponent(UnifiedUpgradeDialogComponent, {
        remove: {
          imports: [UpgradeAccountComponent, UpgradePaymentComponent],
        },
        add: {
          imports: [MockUpgradeAccountComponent, MockUpgradePaymentComponent],
        },
      })
      .compileComponents();

    const newFixture = TestBed.createComponent(UnifiedUpgradeDialogComponent);
    const newComponent = newFixture.componentInstance;
    newFixture.detectChanges();

    if (waitForStable) {
      await newFixture.whenStable();
    }

    return { fixture: newFixture, component: newComponent };
  }

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Default mock: no premium interest
    mockPremiumInterestStateService.getPremiumInterest.mockResolvedValue(false);

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, UnifiedUpgradeDialogComponent],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DIALOG_DATA, useValue: defaultDialogData },
        { provide: Router, useValue: mockRouter },
        { provide: PremiumInterestStateService, useValue: mockPremiumInterestStateService },
      ],
    })
      .overrideComponent(UnifiedUpgradeDialogComponent, {
        remove: {
          imports: [UpgradeAccountComponent, UpgradePaymentComponent],
        },
        add: {
          imports: [MockUpgradeAccountComponent, MockUpgradePaymentComponent],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UnifiedUpgradeDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should initialize with default values", () => {
    expect(component["step"]()).toBe(UnifiedUpgradeDialogStep.PlanSelection);
    expect(component["selectedPlan"]()).toBeNull();
    expect(component["account"]()).toEqual(mockAccount);
    expect(component["planSelectionStepTitleOverride"]()).toBeNull();
  });

  it("should initialize with custom initial step", async () => {
    const customDialogData: UnifiedUpgradeDialogParams = {
      account: mockAccount,
      initialStep: UnifiedUpgradeDialogStep.Payment,
      selectedPlan: PersonalSubscriptionPricingTierIds.Premium,
    };

    const { component: customComponent } = await createComponentWithDialogData(customDialogData);

    expect(customComponent["step"]()).toBe(UnifiedUpgradeDialogStep.Payment);
    expect(customComponent["selectedPlan"]()).toBe(PersonalSubscriptionPricingTierIds.Premium);
  });

  describe("ngOnInit premium interest handling", () => {
    it("should check premium interest on initialization", async () => {
      // Component already initialized in beforeEach
      expect(mockPremiumInterestStateService.getPremiumInterest).toHaveBeenCalledWith(
        mockAccount.id,
      );
    });

    it("should set hasPremiumInterest signal and clear premium interest when it exists", async () => {
      mockPremiumInterestStateService.getPremiumInterest.mockResolvedValue(true);
      mockPremiumInterestStateService.clearPremiumInterest.mockResolvedValue(undefined);

      const { component: customComponent } = await createComponentWithDialogData(
        defaultDialogData,
        true,
      );

      expect(mockPremiumInterestStateService.getPremiumInterest).toHaveBeenCalledWith(
        mockAccount.id,
      );
      expect(mockPremiumInterestStateService.clearPremiumInterest).toHaveBeenCalledWith(
        mockAccount.id,
      );
      expect(customComponent["hasPremiumInterest"]()).toBe(true);
    });

    it("should not set hasPremiumInterest signal or clear when premium interest does not exist", async () => {
      mockPremiumInterestStateService.getPremiumInterest.mockResolvedValue(false);

      const { component: customComponent } = await createComponentWithDialogData(defaultDialogData);

      expect(mockPremiumInterestStateService.getPremiumInterest).toHaveBeenCalledWith(
        mockAccount.id,
      );
      expect(mockPremiumInterestStateService.clearPremiumInterest).not.toHaveBeenCalled();
      expect(customComponent["hasPremiumInterest"]()).toBe(false);
    });
  });

  describe("custom dialog title", () => {
    it("should use null as default when no override is provided", () => {
      expect(component["planSelectionStepTitleOverride"]()).toBeNull();
    });

    it("should use custom title when provided in dialog config", async () => {
      const customDialogData: UnifiedUpgradeDialogParams = {
        account: mockAccount,
        initialStep: UnifiedUpgradeDialogStep.PlanSelection,
        selectedPlan: null,
        planSelectionStepTitleOverride: "upgradeYourPlan",
      };

      const { component: customComponent } = await createComponentWithDialogData(customDialogData);

      expect(customComponent["planSelectionStepTitleOverride"]()).toBe("upgradeYourPlan");
    });
  });

  describe("onPlanSelected", () => {
    it("should set selected plan and move to payment step", () => {
      component["onPlanSelected"](PersonalSubscriptionPricingTierIds.Premium);

      expect(component["selectedPlan"]()).toBe(PersonalSubscriptionPricingTierIds.Premium);
      expect(component["step"]()).toBe(UnifiedUpgradeDialogStep.Payment);
    });
  });

  describe("previousStep", () => {
    it("should go back to plan selection and clear selected plan", async () => {
      component["step"].set(UnifiedUpgradeDialogStep.Payment);
      component["selectedPlan"].set(PersonalSubscriptionPricingTierIds.Premium);

      await component["previousStep"]();

      expect(component["step"]()).toBe(UnifiedUpgradeDialogStep.PlanSelection);
      expect(component["selectedPlan"]()).toBeNull();
    });
  });

  describe("hideContinueWithoutUpgradingButton", () => {
    it("should default to false when not provided", () => {
      expect(component["hideContinueWithoutUpgradingButton"]()).toBe(false);
    });

    it("should be set to true when provided in dialog config", async () => {
      const customDialogData: UnifiedUpgradeDialogParams = {
        account: mockAccount,
        initialStep: null,
        selectedPlan: null,
        hideContinueWithoutUpgradingButton: true,
      };

      const { component: customComponent } = await createComponentWithDialogData(customDialogData);

      expect(customComponent["hideContinueWithoutUpgradingButton"]()).toBe(true);
    });
  });

  describe("onComplete", () => {
    it("should route to /vault when upgrading to premium with premium interest", async () => {
      // Set up component with premium interest
      mockPremiumInterestStateService.getPremiumInterest.mockResolvedValue(true);
      mockPremiumInterestStateService.clearPremiumInterest.mockResolvedValue(undefined);
      mockRouter.navigate.mockResolvedValue(true);

      const { component: customComponent } = await createComponentWithDialogData(
        defaultDialogData,
        true,
      );

      // Premium interest should be set and cleared during ngOnInit
      expect(mockPremiumInterestStateService.getPremiumInterest).toHaveBeenCalledWith(
        mockAccount.id,
      );
      expect(mockPremiumInterestStateService.clearPremiumInterest).toHaveBeenCalledWith(
        mockAccount.id,
      );
      expect(customComponent["hasPremiumInterest"]()).toBe(true);

      const result: UpgradePaymentResult = {
        status: "upgradedToPremium",
        organizationId: null,
      };

      await customComponent["onComplete"](result);

      // Should route to /vault because hasPremiumInterest signal is true
      // No additional service calls should be made in onComplete
      expect(mockPremiumInterestStateService.getPremiumInterest).toHaveBeenCalledTimes(1); // Only from ngOnInit
      expect(mockPremiumInterestStateService.clearPremiumInterest).toHaveBeenCalledTimes(1); // Only from ngOnInit
      expect(mockRouter.navigate).toHaveBeenCalledWith(["/vault"]);
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        status: "upgradedToPremium",
        organizationId: null,
      });
    });

    it("should close dialog when upgrading to families (premium interest not relevant)", async () => {
      const result: UpgradePaymentResult = {
        status: "upgradedToFamilies",
        organizationId: "org-123",
      };

      await component["onComplete"](result);

      // Premium interest logic only runs for premium upgrades, not families
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        status: "upgradedToFamilies",
        organizationId: "org-123",
      });
    });

    it("should use standard redirect when upgrading to premium without premium interest", async () => {
      const customDialogData: UnifiedUpgradeDialogParams = {
        account: mockAccount,
        redirectOnCompletion: true,
      };

      // No premium interest
      mockPremiumInterestStateService.getPremiumInterest.mockResolvedValue(false);
      mockRouter.navigate.mockResolvedValue(true);

      const { component: customComponent } = await createComponentWithDialogData(customDialogData);

      // Verify no premium interest was set during ngOnInit
      expect(customComponent["hasPremiumInterest"]()).toBe(false);

      const result: UpgradePaymentResult = {
        status: "upgradedToPremium",
        organizationId: null,
      };

      await customComponent["onComplete"](result);

      // Should use standard redirect because hasPremiumInterest signal is false
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        "/settings/subscription/user-subscription",
      ]);
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        status: "upgradedToPremium",
        organizationId: null,
      });
    });
  });

  describe("onCloseClicked", () => {
    it("should close dialog without clearing premium interest (cleared in ngOnInit)", async () => {
      await component["onCloseClicked"]();

      // Premium interest should have been cleared only once during ngOnInit, not again here
      expect(mockPremiumInterestStateService.clearPremiumInterest).toHaveBeenCalledTimes(0);
      expect(mockDialogRef.close).toHaveBeenCalledWith({ status: "closed" });
    });
  });

  describe("previousStep", () => {
    it("should go back to plan selection when on payment step", async () => {
      component["step"].set(UnifiedUpgradeDialogStep.Payment);
      component["selectedPlan"].set(PersonalSubscriptionPricingTierIds.Premium);

      await component["previousStep"]();

      expect(component["step"]()).toBe(UnifiedUpgradeDialogStep.PlanSelection);
      expect(component["selectedPlan"]()).toBeNull();
      expect(mockPremiumInterestStateService.clearPremiumInterest).toHaveBeenCalledTimes(0);
    });

    it("should close dialog when backing out from plan selection step (no premium interest cleared)", async () => {
      const customDialogData: UnifiedUpgradeDialogParams = {
        account: mockAccount,
        initialStep: UnifiedUpgradeDialogStep.Payment,
        selectedPlan: PersonalSubscriptionPricingTierIds.Premium,
      };

      mockPremiumInterestStateService.getPremiumInterest.mockResolvedValue(false);

      const { component: customComponent } = await createComponentWithDialogData(customDialogData);

      // Start at payment step, go back once to reach plan selection, then go back again to close
      await customComponent["previousStep"]();

      // Premium interest cleared only in ngOnInit, not in previousStep
      expect(mockPremiumInterestStateService.clearPremiumInterest).toHaveBeenCalledTimes(0);
      expect(mockDialogRef.close).toHaveBeenCalledWith({ status: "closed" });
    });
  });
});
