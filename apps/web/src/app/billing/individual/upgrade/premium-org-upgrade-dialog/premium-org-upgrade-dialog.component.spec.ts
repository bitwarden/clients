import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import {
  BusinessSubscriptionPricingTierId,
  PersonalSubscriptionPricingTierId,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import {
  PremiumOrgUpgradePaymentComponent,
  PremiumOrgUpgradePaymentResult,
  PremiumOrgUpgradePaymentStatus,
} from "../premium-org-upgrade-payment/premium-org-upgrade-payment.component";
import { PremiumOrgUpgradePlanSelectionComponent } from "../premium-org-upgrade-plan-selection/premium-org-upgrade-plan-selection.component";

import {
  PremiumOrgUpgradeDialogComponent,
  PremiumOrgUpgradeDialogParams,
  PremiumOrgUpgradeDialogStep,
} from "./premium-org-upgrade-dialog.component";

@Component({
  selector: "app-premium-org-upgrade-plan-selection",
  template: "",
  standalone: true,
  providers: [PremiumOrgUpgradePlanSelectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPremiumOrgUpgradePlanSelectionComponent {
  readonly dialogTitleMessageOverride = input<string | null>(null);
  readonly hideContinueWithoutUpgradingButton = input<boolean>(false);
  planSelected = output<BusinessSubscriptionPricingTierId>();
  closeClicked = output<PremiumOrgUpgradePaymentStatus>();
}

@Component({
  selector: "app-premium-org-upgrade-payment",
  template: "",
  standalone: true,
  providers: [PremiumOrgUpgradePaymentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPremiumOrgUpgradePaymentComponent {
  readonly selectedPlanId = input<
    BusinessSubscriptionPricingTierId | PersonalSubscriptionPricingTierId | null
  >(null);
  readonly account = input<Account | null>(null);
  goBack = output<void>();
  complete = output<{ status: PremiumOrgUpgradePaymentStatus; organizationId: string | null }>();
}

describe("PremiumOrgUpgradeDialogComponent", () => {
  let component: PremiumOrgUpgradeDialogComponent;
  let fixture: ComponentFixture<PremiumOrgUpgradeDialogComponent>;
  const mockDialogRef = mock<DialogRef>();
  const mockRouter = mock<Router>();
  const mockBillingAccountProfileStateService = mock<BillingAccountProfileStateService>();
  const mockConfigService = mock<ConfigService>();
  const mockAccount: Account = {
    id: "user-id" as UserId,
    ...mockAccountInfoWith({
      email: "test@example.com",
      name: "Test User",
    }),
  };

  const defaultDialogData: PremiumOrgUpgradeDialogParams = {
    account: mockAccount,
    initialStep: null,
    selectedPlan: null,
  };

  /**
   * Helper function to create and configure a fresh component instance with custom dialog data
   */
  async function createComponentWithDialogData(
    dialogData: PremiumOrgUpgradeDialogParams,
    waitForStable = false,
  ): Promise<{
    fixture: ComponentFixture<PremiumOrgUpgradeDialogComponent>;
    component: PremiumOrgUpgradeDialogComponent;
  }> {
    TestBed.resetTestingModule();
    jest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, PremiumOrgUpgradeDialogComponent],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DIALOG_DATA, useValue: dialogData },
        { provide: Router, useValue: mockRouter },
        {
          provide: BillingAccountProfileStateService,
          useValue: mockBillingAccountProfileStateService,
        },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      .overrideComponent(PremiumOrgUpgradeDialogComponent, {
        remove: {
          imports: [PremiumOrgUpgradePlanSelectionComponent, PremiumOrgUpgradePaymentComponent],
        },
        add: {
          imports: [
            MockPremiumOrgUpgradePlanSelectionComponent,
            MockPremiumOrgUpgradePaymentComponent,
          ],
        },
      })
      .compileComponents();

    const newFixture = TestBed.createComponent(PremiumOrgUpgradeDialogComponent);
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

    mockBillingAccountProfileStateService.hasPremiumPersonally$.mockReturnValue(of(true));
    mockConfigService.getFeatureFlag$.mockReturnValue(of(true));

    await TestBed.configureTestingModule({
      imports: [PremiumOrgUpgradeDialogComponent],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DIALOG_DATA, useValue: defaultDialogData },
        { provide: Router, useValue: mockRouter },
        {
          provide: BillingAccountProfileStateService,
          useValue: mockBillingAccountProfileStateService,
        },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      .overrideComponent(PremiumOrgUpgradeDialogComponent, {
        remove: {
          imports: [PremiumOrgUpgradePlanSelectionComponent, PremiumOrgUpgradePaymentComponent],
        },
        add: {
          imports: [
            MockPremiumOrgUpgradePlanSelectionComponent,
            MockPremiumOrgUpgradePaymentComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PremiumOrgUpgradeDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should initialize with default values", () => {
    expect(component["step"]()).toBe(PremiumOrgUpgradeDialogStep.PlanSelection);
    expect(component["selectedPlan"]()).toBeNull();
    expect(component["account"]()).toEqual(mockAccount);
  });

  it("should initialize with custom initial step", async () => {
    const customDialogData: PremiumOrgUpgradeDialogParams = {
      account: mockAccount,
      initialStep: PremiumOrgUpgradeDialogStep.Payment,
      selectedPlan: "teams" as BusinessSubscriptionPricingTierId,
    };

    const { component: customComponent } = await createComponentWithDialogData(customDialogData);

    expect(customComponent["step"]()).toBe(PremiumOrgUpgradeDialogStep.Payment);
    expect(customComponent["selectedPlan"]()).toBe("teams");
  });

  describe("onPlanSelected", () => {
    it("should set selected plan and move to payment step", () => {
      component["onPlanSelected"]("teams" as BusinessSubscriptionPricingTierId);

      expect(component["selectedPlan"]()).toBe("teams");
      expect(component["step"]()).toBe(PremiumOrgUpgradeDialogStep.Payment);
    });

    it("should handle selecting Enterprise plan", () => {
      component["onPlanSelected"]("enterprise" as BusinessSubscriptionPricingTierId);

      expect(component["selectedPlan"]()).toBe("enterprise");
      expect(component["step"]()).toBe(PremiumOrgUpgradeDialogStep.Payment);
    });
  });

  describe("previousStep", () => {
    it("should go back to plan selection and clear selected plan", async () => {
      component["step"].set(PremiumOrgUpgradeDialogStep.Payment);
      component["selectedPlan"].set("teams" as BusinessSubscriptionPricingTierId);

      await component["previousStep"]();

      expect(component["step"]()).toBe(PremiumOrgUpgradeDialogStep.PlanSelection);
      expect(component["selectedPlan"]()).toBeNull();
    });

    it("should close dialog when backing out from initial step", async () => {
      const customDialogData: PremiumOrgUpgradeDialogParams = {
        account: mockAccount,
        initialStep: PremiumOrgUpgradeDialogStep.Payment,
        selectedPlan: "teams" as BusinessSubscriptionPricingTierId,
      };

      const { component: customComponent } = await createComponentWithDialogData(customDialogData);

      await customComponent["previousStep"]();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ status: "closed" });
    });
  });

  describe("onComplete", () => {
    it("should handle completing upgrade to Families successfully", async () => {
      const { component: testComponent } = await createComponentWithDialogData(defaultDialogData);
      mockRouter.navigate.mockResolvedValue(true);

      const result = {
        status: "upgradedToFamilies" as const,
        organizationId: "org-111",
      };

      await testComponent["onComplete"](result);

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        status: "upgradedToFamilies",
        organizationId: "org-111",
      });
    });

    it("should handle completing upgrade to Teams successfully", async () => {
      const { component: testComponent } = await createComponentWithDialogData(defaultDialogData);
      mockRouter.navigate.mockResolvedValue(true);

      const result = {
        status: "upgradedToTeams" as const,
        organizationId: "org-123",
      };

      await testComponent["onComplete"](result);

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        status: "upgradedToTeams",
        organizationId: "org-123",
      });
    });

    it("should handle completing upgrade to Enterprise successfully", async () => {
      const { component: testComponent } = await createComponentWithDialogData(defaultDialogData);
      mockRouter.navigate.mockResolvedValue(true);

      const result = {
        status: "upgradedToEnterprise" as const,
        organizationId: "org-456",
      };

      await testComponent["onComplete"](result);

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        status: "upgradedToEnterprise",
        organizationId: "org-456",
      });
    });

    it("should redirect to organization vault after Teams upgrade when redirectOnCompletion is true", async () => {
      const customDialogData: PremiumOrgUpgradeDialogParams = {
        account: mockAccount,
        redirectOnCompletion: true,
      };

      mockRouter.navigate.mockResolvedValue(true);

      const { component: customComponent } = await createComponentWithDialogData(customDialogData);

      const result = {
        status: "upgradedToTeams" as const,
        organizationId: "org-123",
      };

      await customComponent["onComplete"](result);

      expect(mockRouter.navigate).toHaveBeenCalledWith(["/organizations/org-123/vault"]);
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        status: "upgradedToTeams",
        organizationId: "org-123",
      });
    });

    it("should redirect to organization vault after Enterprise upgrade when redirectOnCompletion is true", async () => {
      const customDialogData: PremiumOrgUpgradeDialogParams = {
        account: mockAccount,
        redirectOnCompletion: true,
      };

      mockRouter.navigate.mockResolvedValue(true);

      const { component: customComponent } = await createComponentWithDialogData(customDialogData);

      const result = {
        status: "upgradedToEnterprise" as const,
        organizationId: "org-789",
      };

      await customComponent["onComplete"](result);

      expect(mockRouter.navigate).toHaveBeenCalledWith(["/organizations/org-789/vault"]);
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        status: "upgradedToEnterprise",
        organizationId: "org-789",
      });
    });

    it("should redirect to organization vault after Families upgrade when redirectOnCompletion is true", async () => {
      const customDialogData: PremiumOrgUpgradeDialogParams = {
        account: mockAccount,
        redirectOnCompletion: true,
      };

      mockRouter.navigate.mockResolvedValue(true);

      const { component: customComponent } = await createComponentWithDialogData(customDialogData);

      const result = {
        status: "upgradedToFamilies" as const,
        organizationId: "org-999",
      };

      await customComponent["onComplete"](result);

      expect(mockRouter.navigate).toHaveBeenCalledWith(["/organizations/org-999/vault"]);
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        status: "upgradedToFamilies",
        organizationId: "org-999",
      });
    });

    it("should not redirect when redirectOnCompletion is false", async () => {
      const customDialogData: PremiumOrgUpgradeDialogParams = {
        account: mockAccount,
        redirectOnCompletion: false,
      };

      const { component: customComponent } = await createComponentWithDialogData(customDialogData);

      const result = {
        status: "upgradedToTeams" as const,
        organizationId: "org-123",
      };

      await customComponent["onComplete"](result);

      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalledWith({
        status: "upgradedToTeams",
        organizationId: "org-123",
      });
    });

    it("should handle closed status", async () => {
      const { component: testComponent } = await createComponentWithDialogData(defaultDialogData);

      const result: PremiumOrgUpgradePaymentResult = { status: "closed", organizationId: null };

      await testComponent["onComplete"](result);

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        status: "closed",
        organizationId: null,
      });
    });
  });

  describe("onCloseClicked", () => {
    it("should close dialog", async () => {
      await component["onCloseClicked"]();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ status: "closed" });
    });
  });

  describe("Premium and Feature Flag Requirements", () => {
    it("should close dialog immediately if user does not have premium", async () => {
      mockBillingAccountProfileStateService.hasPremiumPersonally$.mockReturnValue(of(false));
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));

      await createComponentWithDialogData(defaultDialogData, true);

      expect(mockDialogRef.close).toHaveBeenCalledWith({ status: "closed" });
    });

    it("should close dialog immediately if feature flag is not enabled", async () => {
      mockBillingAccountProfileStateService.hasPremiumPersonally$.mockReturnValue(of(true));
      mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

      await createComponentWithDialogData(defaultDialogData, true);

      expect(mockDialogRef.close).toHaveBeenCalledWith({ status: "closed" });
    });

    it("should close dialog immediately if user does not have premium and feature flag is not enabled", async () => {
      mockBillingAccountProfileStateService.hasPremiumPersonally$.mockReturnValue(of(false));
      mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

      await createComponentWithDialogData(defaultDialogData, true);

      expect(mockDialogRef.close).toHaveBeenCalledWith({ status: "closed" });
    });
  });

  describe("Child Component Display Logic", () => {
    describe("Plan Selection Step", () => {
      it("should display app-premium-org-upgrade-plan-selection on plan selection step", async () => {
        const { fixture } = await createComponentWithDialogData(defaultDialogData);

        const premiumOrgUpgradeElement = fixture.nativeElement.querySelector(
          "app-premium-org-upgrade-plan-selection",
        );

        expect(premiumOrgUpgradeElement).toBeTruthy();
      });
    });

    describe("Payment Step", () => {
      it("should display app-premium-org-upgrade-payment on payment step", async () => {
        const customDialogData: PremiumOrgUpgradeDialogParams = {
          account: mockAccount,
          initialStep: PremiumOrgUpgradeDialogStep.Payment,
          selectedPlan: "teams" as BusinessSubscriptionPricingTierId,
        };

        const { fixture } = await createComponentWithDialogData(customDialogData);

        const premiumOrgUpgradePaymentElement = fixture.nativeElement.querySelector(
          "app-premium-org-upgrade-payment",
        );

        expect(premiumOrgUpgradePaymentElement).toBeTruthy();
      });
    });
  });
});
