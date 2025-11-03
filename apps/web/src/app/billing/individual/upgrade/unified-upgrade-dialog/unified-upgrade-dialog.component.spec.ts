import { Component, input, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";

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
    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, UnifiedUpgradeDialogComponent],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DIALOG_DATA, useValue: defaultDialogData },
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

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, UnifiedUpgradeDialogComponent],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DIALOG_DATA, useValue: customDialogData },
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

      await TestBed.configureTestingModule({
        imports: [NoopAnimationsModule, UnifiedUpgradeDialogComponent],
        providers: [
          { provide: DialogRef, useValue: mockDialogRef },
          { provide: DIALOG_DATA, useValue: customDialogData },
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
    it("should go back to plan selection and clear selected plan", () => {
      component["step"].set(UnifiedUpgradeDialogStep.Payment);
      component["selectedPlan"].set(PersonalSubscriptionPricingTierIds.Premium);

      component["previousStep"]();

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

      await TestBed.configureTestingModule({
        imports: [NoopAnimationsModule, UnifiedUpgradeDialogComponent],
        providers: [
          { provide: DialogRef, useValue: mockDialogRef },
          { provide: DIALOG_DATA, useValue: customDialogData },
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
});
