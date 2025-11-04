import { Component, input, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PremiumInterestStateService } from "@bitwarden/angular/billing/services/premium-interest/premium-interest-state.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-upgrade-account",
  template: "",
  standalone: true,
})
class MockUpgradeAccountComponent {
  readonly dialogTitleMessageOverride = input<string | null>(null);
  readonly hideContinueWithoutUpgradingButton = input<boolean>(false);
  planSelected = output<PersonalSubscriptionPricingTierId>();
  closeClicked = output<UpgradeAccountStatus>();
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-upgrade-payment",
  template: "",
  standalone: true,
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
  const mockAccountService = mock<AccountService>();
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

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    mockAccountService.activeAccount$ = of(mockAccount);

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, UnifiedUpgradeDialogComponent],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DIALOG_DATA, useValue: defaultDialogData },
        { provide: Router, useValue: mockRouter },
        { provide: AccountService, useValue: mockAccountService },
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
    TestBed.resetTestingModule();

    const customDialogData: UnifiedUpgradeDialogParams = {
      account: mockAccount,
      initialStep: UnifiedUpgradeDialogStep.Payment,
      selectedPlan: PersonalSubscriptionPricingTierIds.Premium,
    };

    mockAccountService.activeAccount$ = of(mockAccount);

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, UnifiedUpgradeDialogComponent],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DIALOG_DATA, useValue: customDialogData },
        { provide: Router, useValue: mockRouter },
        { provide: AccountService, useValue: mockAccountService },
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

    const customFixture = TestBed.createComponent(UnifiedUpgradeDialogComponent);
    const customComponent = customFixture.componentInstance;
    customFixture.detectChanges();

    expect(customComponent["step"]()).toBe(UnifiedUpgradeDialogStep.Payment);
    expect(customComponent["selectedPlan"]()).toBe(PersonalSubscriptionPricingTierIds.Premium);
  });

  describe("custom dialog title", () => {
    it("should use null as default when no override is provided", () => {
      expect(component["planSelectionStepTitleOverride"]()).toBeNull();
    });

    it("should use custom title when provided in dialog config", async () => {
      TestBed.resetTestingModule();

      const customDialogData: UnifiedUpgradeDialogParams = {
        account: mockAccount,
        initialStep: UnifiedUpgradeDialogStep.PlanSelection,
        selectedPlan: null,
        planSelectionStepTitleOverride: "upgradeYourPlan",
      };

      mockAccountService.activeAccount$ = of(mockAccount);

      await TestBed.configureTestingModule({
        imports: [NoopAnimationsModule, UnifiedUpgradeDialogComponent],
        providers: [
          { provide: DialogRef, useValue: mockDialogRef },
          { provide: DIALOG_DATA, useValue: customDialogData },
          { provide: Router, useValue: mockRouter },
          { provide: AccountService, useValue: mockAccountService },
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

      const customFixture = TestBed.createComponent(UnifiedUpgradeDialogComponent);
      const customComponent = customFixture.componentInstance;
      customFixture.detectChanges();

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
      TestBed.resetTestingModule();

      const customDialogData: UnifiedUpgradeDialogParams = {
        account: mockAccount,
        initialStep: null,
        selectedPlan: null,
        hideContinueWithoutUpgradingButton: true,
      };

      mockAccountService.activeAccount$ = of(mockAccount);

      await TestBed.configureTestingModule({
        imports: [NoopAnimationsModule, UnifiedUpgradeDialogComponent],
        providers: [
          { provide: DialogRef, useValue: mockDialogRef },
          { provide: DIALOG_DATA, useValue: customDialogData },
          { provide: Router, useValue: mockRouter },
          { provide: AccountService, useValue: mockAccountService },
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

      const customFixture = TestBed.createComponent(UnifiedUpgradeDialogComponent);
      const customComponent = customFixture.componentInstance;
      customFixture.detectChanges();

      expect(customComponent["hideContinueWithoutUpgradingButton"]()).toBe(true);
    });
  });

  describe("onComplete with premium interest", () => {
    it("should check premium interest, clear it, and route to /vault when premium interest exists", async () => {
      mockPremiumInterestStateService.getPremiumInterest.mockResolvedValue(true);
      mockPremiumInterestStateService.clearPremiumInterest.mockResolvedValue();
      mockRouter.navigate.mockResolvedValue(true);

      const result: UpgradePaymentResult = {
        status: "upgradedToPremium",
        organizationId: null,
      };

      await component["onComplete"](result);

      expect(mockPremiumInterestStateService.getPremiumInterest).toHaveBeenCalledWith(
        mockAccount.id,
      );
      expect(mockPremiumInterestStateService.clearPremiumInterest).toHaveBeenCalledWith(
        mockAccount.id,
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(["/vault"]);
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        status: "upgradedToPremium",
        organizationId: null,
      });
    });

    it("should not clear premium interest when upgrading to families", async () => {
      const result: UpgradePaymentResult = {
        status: "upgradedToFamilies",
        organizationId: "org-123",
      };

      await component["onComplete"](result);

      expect(mockPremiumInterestStateService.getPremiumInterest).not.toHaveBeenCalled();
      expect(mockPremiumInterestStateService.clearPremiumInterest).not.toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        status: "upgradedToFamilies",
        organizationId: "org-123",
      });
    });

    it("should use standard redirect when no premium interest exists", async () => {
      TestBed.resetTestingModule();

      const customDialogData: UnifiedUpgradeDialogParams = {
        account: mockAccount,
        redirectOnCompletion: true,
      };

      mockAccountService.activeAccount$ = of(mockAccount);
      mockPremiumInterestStateService.getPremiumInterest.mockResolvedValue(false);
      mockRouter.navigate.mockResolvedValue(true);

      await TestBed.configureTestingModule({
        imports: [NoopAnimationsModule, UnifiedUpgradeDialogComponent],
        providers: [
          { provide: DialogRef, useValue: mockDialogRef },
          { provide: DIALOG_DATA, useValue: customDialogData },
          { provide: Router, useValue: mockRouter },
          { provide: AccountService, useValue: mockAccountService },
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

      const customFixture = TestBed.createComponent(UnifiedUpgradeDialogComponent);
      const customComponent = customFixture.componentInstance;
      customFixture.detectChanges();

      const result: UpgradePaymentResult = {
        status: "upgradedToPremium",
        organizationId: null,
      };

      await customComponent["onComplete"](result);

      expect(mockPremiumInterestStateService.getPremiumInterest).toHaveBeenCalledWith(
        mockAccount.id,
      );
      expect(mockPremiumInterestStateService.clearPremiumInterest).not.toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        "/settings/subscription/user-subscription",
      ]);
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        status: "upgradedToPremium",
        organizationId: null,
      });
    });

    it("should handle null account gracefully", async () => {
      mockAccountService.activeAccount$ = of(null);
      mockRouter.navigate.mockResolvedValue(true);

      const result: UpgradePaymentResult = {
        status: "upgradedToPremium",
        organizationId: null,
      };

      await component["onComplete"](result);

      expect(mockPremiumInterestStateService.getPremiumInterest).not.toHaveBeenCalled();
      expect(mockPremiumInterestStateService.clearPremiumInterest).not.toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        status: "upgradedToPremium",
        organizationId: null,
      });
    });
  });

  describe("onCloseClicked with premium interest", () => {
    it("should clear premium interest when modal is closed", async () => {
      mockPremiumInterestStateService.clearPremiumInterest.mockResolvedValue();

      await component["onCloseClicked"]();

      expect(mockPremiumInterestStateService.clearPremiumInterest).toHaveBeenCalledWith(
        mockAccount.id,
      );
      expect(mockDialogRef.close).toHaveBeenCalledWith({ status: "closed" });
    });

    it("should handle null account gracefully when closing", async () => {
      mockAccountService.activeAccount$ = of(null);

      await component["onCloseClicked"]();

      expect(mockPremiumInterestStateService.clearPremiumInterest).not.toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalledWith({ status: "closed" });
    });
  });

  describe("previousStep with premium interest", () => {
    it("should NOT clear premium interest when navigating between steps", async () => {
      component["step"].set(UnifiedUpgradeDialogStep.Payment);
      component["selectedPlan"].set(PersonalSubscriptionPricingTierIds.Premium);

      await component["previousStep"]();

      expect(mockPremiumInterestStateService.clearPremiumInterest).not.toHaveBeenCalled();
      expect(component["step"]()).toBe(UnifiedUpgradeDialogStep.PlanSelection);
      expect(component["selectedPlan"]()).toBeNull();
    });

    it("should clear premium interest when backing out of dialog completely", async () => {
      TestBed.resetTestingModule();

      const customDialogData: UnifiedUpgradeDialogParams = {
        account: mockAccount,
        initialStep: UnifiedUpgradeDialogStep.Payment,
        selectedPlan: PersonalSubscriptionPricingTierIds.Premium,
      };

      mockAccountService.activeAccount$ = of(mockAccount);
      mockPremiumInterestStateService.clearPremiumInterest.mockResolvedValue();

      await TestBed.configureTestingModule({
        imports: [NoopAnimationsModule, UnifiedUpgradeDialogComponent],
        providers: [
          { provide: DialogRef, useValue: mockDialogRef },
          { provide: DIALOG_DATA, useValue: customDialogData },
          { provide: Router, useValue: mockRouter },
          { provide: AccountService, useValue: mockAccountService },
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

      const customFixture = TestBed.createComponent(UnifiedUpgradeDialogComponent);
      const customComponent = customFixture.componentInstance;
      customFixture.detectChanges();

      await customComponent["previousStep"]();

      expect(mockPremiumInterestStateService.clearPremiumInterest).toHaveBeenCalledWith(
        mockAccount.id,
      );
      expect(mockDialogRef.close).toHaveBeenCalledWith({ status: "closed" });
    });

    it("should handle null account gracefully when backing out", async () => {
      TestBed.resetTestingModule();

      const customDialogData: UnifiedUpgradeDialogParams = {
        account: mockAccount,
        initialStep: UnifiedUpgradeDialogStep.Payment,
        selectedPlan: PersonalSubscriptionPricingTierIds.Premium,
      };

      mockAccountService.activeAccount$ = of(null);

      await TestBed.configureTestingModule({
        imports: [NoopAnimationsModule, UnifiedUpgradeDialogComponent],
        providers: [
          { provide: DialogRef, useValue: mockDialogRef },
          { provide: DIALOG_DATA, useValue: customDialogData },
          { provide: Router, useValue: mockRouter },
          { provide: AccountService, useValue: mockAccountService },
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

      const customFixture = TestBed.createComponent(UnifiedUpgradeDialogComponent);
      const customComponent = customFixture.componentInstance;
      customFixture.detectChanges();

      await customComponent["previousStep"]();

      expect(mockPremiumInterestStateService.clearPremiumInterest).not.toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalledWith({ status: "closed" });
    });
  });
});
