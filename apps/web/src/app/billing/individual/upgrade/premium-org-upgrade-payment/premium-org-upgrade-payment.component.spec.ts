import {
  Component,
  input,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
  signal,
} from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import {
  BusinessSubscriptionPricingTier,
  BusinessSubscriptionPricingTierId,
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierId,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { CartSummaryComponent } from "@bitwarden/pricing";

import { AccountBillingClient } from "../../../clients/account-billing.client";
import { PreviewInvoiceClient } from "../../../clients/preview-invoice.client";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
} from "../../../payment/components";

import {
  PremiumOrgUpgradePaymentComponent,
  PremiumOrgUpgradePaymentStatus,
} from "./premium-org-upgrade-payment.component";
import { PremiumOrgUpgradeService } from "./services/premium-org-upgrade.service";

// Mock Components
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "billing-cart-summary",
  template: `<h1>Mock Cart Summary</h1>`,
  providers: [{ provide: CartSummaryComponent, useClass: MockCartSummaryComponent }],
})
class MockCartSummaryComponent {
  readonly cart = input.required<any>();
  readonly header = input<any>();
  readonly isExpanded = signal(false);
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-enter-payment-method",
  template: `<h1>Mock Enter Payment Method</h1>`,
  providers: [
    {
      provide: EnterPaymentMethodComponent,
      useClass: MockEnterPaymentMethodComponent,
    },
  ],
})
class MockEnterPaymentMethodComponent {
  readonly group = input.required<any>();
  readonly showBankAccount = input(true);
  readonly showPayPal = input(true);
  readonly showAccountCredit = input(false);
  readonly hasEnoughAccountCredit = input(true);
  readonly includeBillingAddress = input(false);

  tokenize = jest.fn().mockResolvedValue({ type: "card", token: "mock-token" });
  validate = jest.fn().mockReturnValue(true);

  static getFormGroup = () =>
    new FormGroup({
      type: new FormControl<string>("card", { nonNullable: true }),
      bankAccount: new FormGroup({
        routingNumber: new FormControl<string>("", { nonNullable: true }),
        accountNumber: new FormControl<string>("", { nonNullable: true }),
        accountHolderName: new FormControl<string>("", { nonNullable: true }),
        accountHolderType: new FormControl<string>("", { nonNullable: true }),
      }),
      billingAddress: new FormGroup({
        country: new FormControl<string>("", { nonNullable: true }),
        postalCode: new FormControl<string>("", { nonNullable: true }),
      }),
    });
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-enter-billing-address",
  template: `<h1>Mock Enter Billing Address</h1>`,
  providers: [
    {
      provide: EnterBillingAddressComponent,
      useClass: MockEnterBillingAddressComponent,
    },
  ],
})
class MockEnterBillingAddressComponent {
  readonly scenario = input.required<any>();
  readonly group = input.required<any>();

  static getFormGroup = () =>
    new FormGroup({
      country: new FormControl<string>("", {
        nonNullable: true,
        validators: [Validators.required],
      }),
      postalCode: new FormControl<string>("", {
        nonNullable: true,
        validators: [Validators.required],
      }),
      line1: new FormControl<string | null>(null),
      line2: new FormControl<string | null>(null),
      city: new FormControl<string | null>(null),
      state: new FormControl<string | null>(null),
      taxId: new FormControl<string | null>(null),
    });
}

describe("PremiumOrgUpgradePaymentComponent", () => {
  beforeAll(() => {
    // Mock IntersectionObserver - required because DialogComponent uses it to detect scrollable content.
    // This browser API doesn't exist in the Jest/Node.js test environment.
    // This is necessary because we are unable to mock DialogComponent which is not directly importable
    global.IntersectionObserver = class IntersectionObserver {
      constructor() {}
      disconnect() {}
      observe() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      unobserve() {}
    } as any;
  });

  let component: PremiumOrgUpgradePaymentComponent;
  let fixture: ComponentFixture<PremiumOrgUpgradePaymentComponent>;
  const mockPremiumOrgUpgradeService = mock<PremiumOrgUpgradeService>();
  const mockSubscriptionPricingService = mock<SubscriptionPricingServiceAbstraction>();
  const mockToastService = mock<ToastService>();
  const mockAccountBillingClient = mock<AccountBillingClient>();
  const mockPreviewInvoiceClient = mock<PreviewInvoiceClient>();
  const mockLogService = mock<LogService>();
  const mockI18nService = { t: jest.fn((key: string, ...params: any[]) => key) };

  const mockAccount = { id: "user-id", email: "test@bitwarden.com" } as Account;
  const mockTeamsPlan: BusinessSubscriptionPricingTier = {
    id: "teams",
    name: "Teams",
    description: "Teams plan",
    availableCadences: ["annually"],
    passwordManager: {
      annualPricePerUser: 48,
      type: "scalable",
      features: [],
    },
    secretsManager: {
      annualPricePerUser: 24,
      type: "scalable",
      features: [],
    },
  };
  const mockFamiliesPlan: PersonalSubscriptionPricingTier = {
    id: "families",
    name: "Families",
    description: "Families plan",
    availableCadences: ["annually"],
    passwordManager: {
      annualPrice: 40,
      users: 6,
      type: "packaged",
      features: [],
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAccountBillingClient.upgradePremiumToOrganization.mockResolvedValue(undefined);
    mockPremiumOrgUpgradeService.upgradeToOrganization.mockResolvedValue(undefined);
    mockPremiumOrgUpgradeService.previewProratedInvoice.mockResolvedValue({
      tax: 5.0,
      total: 53.0,
      credit: 10.0,
      proratedAmountOfMonths: 1,
    });

    mockSubscriptionPricingService.getBusinessSubscriptionPricingTiers$.mockReturnValue(
      of([mockTeamsPlan]),
    );
    mockSubscriptionPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(
      of([mockFamiliesPlan]),
    );

    await TestBed.configureTestingModule({
      imports: [PremiumOrgUpgradePaymentComponent],
      providers: [
        { provide: PremiumOrgUpgradeService, useValue: mockPremiumOrgUpgradeService },
        {
          provide: SubscriptionPricingServiceAbstraction,
          useValue: mockSubscriptionPricingService,
        },
        { provide: ToastService, useValue: mockToastService },
        { provide: LogService, useValue: mockLogService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: AccountBillingClient, useValue: mockAccountBillingClient },
        { provide: PreviewInvoiceClient, useValue: mockPreviewInvoiceClient },
        {
          provide: KeyService,
          useValue: {
            makeOrgKey: jest.fn().mockResolvedValue(["encrypted-key", "decrypted-key"]),
          },
        },
        {
          provide: SyncService,
          useValue: { fullSync: jest.fn().mockResolvedValue(undefined) },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideComponent(PremiumOrgUpgradePaymentComponent, {
        add: {
          imports: [
            MockEnterBillingAddressComponent,
            MockEnterPaymentMethodComponent,
            MockCartSummaryComponent,
          ],
        },
        remove: {
          imports: [
            EnterBillingAddressComponent,
            EnterPaymentMethodComponent,
            CartSummaryComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PremiumOrgUpgradePaymentComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput("selectedPlanId", "teams" as BusinessSubscriptionPricingTierId);
    fixture.componentRef.setInput("account", mockAccount);
    fixture.detectChanges();

    // Wait for ngOnInit to complete
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should initialize with the correct plan details", () => {
    expect(component["selectedPlan"]()).not.toBeNull();
    expect(component["selectedPlan"]()?.details.id).toBe("teams");
    expect(component["upgradeToMessage"]()).toContain("upgradeToTeams");
  });

  it("should handle invalid plan id that doesn't exist in pricing tiers", async () => {
    // Create a fresh component with an invalid plan ID from the start
    const newFixture = TestBed.createComponent(PremiumOrgUpgradePaymentComponent);
    const newComponent = newFixture.componentInstance;

    newFixture.componentRef.setInput(
      "selectedPlanId",
      "non-existent-plan" as BusinessSubscriptionPricingTierId,
    );
    newFixture.componentRef.setInput("account", mockAccount);
    newFixture.detectChanges();

    await newFixture.whenStable();

    expect(newComponent["selectedPlan"]()).toBeNull();
  });

  it("should handle invoice preview errors gracefully", fakeAsync(() => {
    mockPremiumOrgUpgradeService.previewProratedInvoice.mockRejectedValue(
      new Error("Network error"),
    );

    // Component should still render and be usable even when invoice preview fails
    fixture = TestBed.createComponent(PremiumOrgUpgradePaymentComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("selectedPlanId", "teams" as BusinessSubscriptionPricingTierId);
    fixture.componentRef.setInput("account", mockAccount);
    fixture.detectChanges();
    tick();

    expect(component).toBeTruthy();
    expect(component["selectedPlan"]()).not.toBeNull();
    expect(mockToastService.showToast).not.toHaveBeenCalled();
  }));

  describe("submit", () => {
    it("should successfully upgrade to organization", async () => {
      const completeSpy = jest.spyOn(component["complete"], "emit");

      // Mock isFormValid and processUpgrade to bypass form validation
      jest.spyOn(component as any, "isFormValid").mockReturnValue(true);
      jest.spyOn(component as any, "processUpgrade").mockResolvedValue({
        status: PremiumOrgUpgradePaymentStatus.UpgradedToTeams,
        organizationId: null,
      });

      component["formGroup"].setValue({
        organizationName: "My New Org",
        paymentForm: {
          type: "card",
          bankAccount: {
            routingNumber: "",
            accountNumber: "",
            accountHolderName: "",
            accountHolderType: "",
          },
          billingAddress: {
            country: "",
            postalCode: "",
          },
        },
        billingAddress: {
          country: "US",
          postalCode: "90210",
          line1: "123 Main St",
          line2: "",
          city: "Beverly Hills",
          state: "CA",
          taxId: "",
        },
      });

      await component["submit"]();

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "organizationUpdated",
      });
      expect(completeSpy).toHaveBeenCalledWith({
        status: PremiumOrgUpgradePaymentStatus.UpgradedToTeams,
        organizationId: null,
      });
    });

    it("should show an error toast if upgrade fails", async () => {
      // Mock isFormValid to return true
      jest.spyOn(component as any, "isFormValid").mockReturnValue(true);
      // Mock processUpgrade to throw an error
      jest
        .spyOn(component as any, "processUpgrade")
        .mockRejectedValue(new Error("Submission Error"));

      component["formGroup"].setValue({
        organizationName: "My New Org",
        paymentForm: {
          type: "card",
          bankAccount: {
            routingNumber: "",
            accountNumber: "",
            accountHolderName: "",
            accountHolderType: "",
          },
          billingAddress: {
            country: "",
            postalCode: "",
          },
        },
        billingAddress: {
          country: "US",
          postalCode: "90210",
          line1: "123 Main St",
          line2: "",
          city: "Beverly Hills",
          state: "CA",
          taxId: "",
        },
      });

      await component["submit"]();

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "upgradeErrorMessage",
      });
    });

    it("should not submit if the form is invalid", async () => {
      const markAllAsTouchedSpy = jest.spyOn(component["formGroup"], "markAllAsTouched");
      component["formGroup"].get("organizationName")?.setValue("");
      fixture.detectChanges();

      await component["submit"]();

      expect(markAllAsTouchedSpy).toHaveBeenCalled();
      expect(mockPremiumOrgUpgradeService.upgradeToOrganization).not.toHaveBeenCalled();
    });
  });

  it("should map plan id to correct upgrade status", () => {
    expect(component["getUpgradeStatus"]("families" as PersonalSubscriptionPricingTierId)).toBe(
      PremiumOrgUpgradePaymentStatus.UpgradedToFamilies,
    );
    expect(component["getUpgradeStatus"]("teams" as BusinessSubscriptionPricingTierId)).toBe(
      PremiumOrgUpgradePaymentStatus.UpgradedToTeams,
    );
    expect(component["getUpgradeStatus"]("enterprise" as BusinessSubscriptionPricingTierId)).toBe(
      PremiumOrgUpgradePaymentStatus.UpgradedToEnterprise,
    );
    expect(component["getUpgradeStatus"]("some-other-plan" as any)).toBe(
      PremiumOrgUpgradePaymentStatus.Closed,
    );
  });

  describe("Invoice Preview", () => {
    it("should return zero values when billing address is incomplete", fakeAsync(() => {
      component["formGroup"].patchValue({
        organizationName: "Test Org",
        billingAddress: {
          country: "US",
          postalCode: "", // Missing postal code
        },
      });

      tick(1000);
      fixture.detectChanges();

      const estimatedInvoice = component["estimatedInvoice"]();
      expect(estimatedInvoice.tax).toBe(0);
      expect(estimatedInvoice.total).toBe(0);
    }));
  });

  describe("Form Validation", () => {
    it("should validate organization name is required", () => {
      component["formGroup"].patchValue({ organizationName: "" });
      expect(component["formGroup"].get("organizationName")?.invalid).toBe(true);
    });

    it("should validate organization name when provided", () => {
      component["formGroup"].patchValue({ organizationName: "My Organization" });
      expect(component["formGroup"].get("organizationName")?.valid).toBe(true);
    });

    it("should return false when payment component validation fails", () => {
      component["formGroup"].patchValue({
        organizationName: "Test Org",
        billingAddress: {
          country: "US",
          postalCode: "12345",
        },
      });

      const mockPaymentComponent = {
        validate: jest.fn().mockReturnValue(false),
      } as any;
      jest.spyOn(component, "paymentComponent").mockReturnValue(mockPaymentComponent);

      expect(component["isFormValid"]()).toBe(false);
    });
  });

  describe("Cart Calculation", () => {
    it("should calculate cart with correct values for selected plan", () => {
      const cart = component["cart"]();
      expect(cart.passwordManager.seats.cost).toBe(48); // Teams annual price per user
      expect(cart.passwordManager.seats.quantity).toBe(1);
      expect(cart.cadence).toBe("annually");
    });

    it("should return default cart when no plan is selected", () => {
      component["selectedPlan"].set(null);
      const cart = component["cart"]();

      expect(cart.passwordManager.seats.cost).toBe(0);
      expect(cart.passwordManager.seats.quantity).toBe(0);
      expect(cart.estimatedTax).toBe(0);
    });
  });

  describe("ngAfterViewInit", () => {
    it("should collapse cart summary after view init", () => {
      const mockCartSummary = {
        isExpanded: signal(true),
      } as any;
      jest.spyOn(component, "cartSummaryComponent").mockReturnValue(mockCartSummary);

      component.ngAfterViewInit();

      expect(mockCartSummary.isExpanded()).toBe(false);
    });
  });

  describe("Plan Price Calculation", () => {
    it("should calculate price for personal plan with annualPrice", () => {
      const price = component["getPlanPrice"](mockFamiliesPlan);
      expect(price).toBe(40);
    });

    it("should calculate price for business plan with annualPricePerUser", () => {
      const price = component["getPlanPrice"](mockTeamsPlan);
      expect(price).toBe(48);
    });

    it("should return 0 when passwordManager is missing", () => {
      const invalidPlan = { ...mockTeamsPlan, passwordManager: undefined } as any;
      const price = component["getPlanPrice"](invalidPlan);
      expect(price).toBe(0);
    });
  });

  describe("processUpgrade", () => {
    it("should throw error when billing address is incomplete", async () => {
      component["formGroup"].patchValue({
        organizationName: "Test Org",
        billingAddress: {
          country: "",
          postalCode: "",
        },
      });

      const mockPaymentComponent = {
        tokenize: jest.fn().mockResolvedValue({ type: "card", token: "mock-token" }),
      } as any;
      jest.spyOn(component, "paymentComponent").mockReturnValue(mockPaymentComponent);

      await expect(component["processUpgrade"]()).rejects.toThrow("Billing address is incomplete");
    });

    it("should throw error when organization name is missing", async () => {
      component["formGroup"].patchValue({
        organizationName: "",
        billingAddress: {
          country: "US",
          postalCode: "12345",
        },
      });

      const mockPaymentComponent = {
        tokenize: jest.fn().mockResolvedValue({ type: "card", token: "mock-token" }),
      } as any;
      jest.spyOn(component, "paymentComponent").mockReturnValue(mockPaymentComponent);

      await expect(component["processUpgrade"]()).rejects.toThrow("Organization name is required");
    });

    it("should throw error when payment method tokenization fails", async () => {
      component["formGroup"].patchValue({
        organizationName: "Test Org",
        billingAddress: {
          country: "US",
          postalCode: "12345",
        },
      });

      const mockPaymentComponent = {
        tokenize: jest.fn().mockResolvedValue(null),
      } as any;
      jest.spyOn(component, "paymentComponent").mockReturnValue(mockPaymentComponent);

      await expect(component["processUpgrade"]()).rejects.toThrow("Payment method is required");
    });
  });

  describe("Plan Membership Messages", () => {
    it("should return correct membership message for families plan", async () => {
      const newFixture = TestBed.createComponent(PremiumOrgUpgradePaymentComponent);
      const newComponent = newFixture.componentInstance;

      newFixture.componentRef.setInput(
        "selectedPlanId",
        "families" as PersonalSubscriptionPricingTierId,
      );
      newFixture.componentRef.setInput("account", mockAccount);
      newFixture.detectChanges();
      await newFixture.whenStable();

      expect(newComponent["planMembershipMessage"]()).toBe("familiesMembership");
    });

    it("should return correct membership message for teams plan", () => {
      expect(component["planMembershipMessage"]()).toBe("teamsMembership");
    });

    it("should return correct membership message for enterprise plan", async () => {
      const newFixture = TestBed.createComponent(PremiumOrgUpgradePaymentComponent);
      const newComponent = newFixture.componentInstance;

      newFixture.componentRef.setInput(
        "selectedPlanId",
        "enterprise" as BusinessSubscriptionPricingTierId,
      );
      newFixture.componentRef.setInput("account", mockAccount);
      newFixture.detectChanges();
      await newFixture.whenStable();

      expect(newComponent["planMembershipMessage"]()).toBe("enterpriseMembership");
    });
  });

  describe("Error Handling", () => {
    it("should log error and continue when submit fails", async () => {
      jest.spyOn(component as any, "isFormValid").mockReturnValue(true);
      jest.spyOn(component as any, "processUpgrade").mockRejectedValue(new Error("Network error"));

      await component["submit"]();

      expect(mockLogService.error).toHaveBeenCalledWith("Upgrade failed:", expect.any(Error));
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "upgradeErrorMessage",
      });
    });
  });

  describe("goBack Output", () => {
    it("should emit goBack event when back action is triggered", () => {
      const goBackSpy = jest.spyOn(component["goBack"], "emit");
      component["goBack"].emit();
      expect(goBackSpy).toHaveBeenCalled();
    });
  });
});
