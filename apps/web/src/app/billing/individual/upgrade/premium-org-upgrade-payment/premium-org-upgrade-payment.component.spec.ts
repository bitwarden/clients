import { Component, input, ChangeDetectionStrategy, signal, output } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { FormControl, FormGroup } from "@angular/forms";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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
import { SubscriberBillingClient } from "../../../clients/subscriber-billing.client";
import {
  EnterBillingAddressComponent,
  DisplayPaymentMethodInlineComponent,
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
  template: "",
})
class MockCartSummaryComponent {
  readonly cart = input.required<any>();
  readonly header = input<any>();
  readonly isExpanded = signal(false);
  readonly hidePricingTerm = input<boolean>(false);
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-display-payment-method-inline",
  template: "",
})
class MockDisplayPaymentMethodInlineComponent {
  readonly subscriber = input.required<any>();
  readonly paymentMethod = input<any>();
  readonly externalFormGroup = input<any>();
  readonly updated = output<any>();
  readonly changePaymentMethodClicked = output<void>();

  isChangingPayment = jest.fn().mockReturnValue(false);
  getTokenizedPaymentMethod = jest.fn().mockResolvedValue({ token: "test-token" });
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
  const mockOrganizationService = mock<OrganizationService>();
  const mockSubscriberBillingClient = mock<SubscriberBillingClient>();
  const mockApiService = mock<ApiService>();
  const mockAccountService = mock<AccountService>();
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

    // Set up minimal mocks needed for component initialization
    mockSubscriptionPricingService.getBusinessSubscriptionPricingTiers$.mockReturnValue(
      of([mockTeamsPlan]),
    );
    mockSubscriptionPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(
      of([mockFamiliesPlan]),
    );
    mockAccountService.activeAccount$ = of(mockAccount);
    mockSubscriberBillingClient.getPaymentMethod.mockResolvedValue({
      type: "card",
      brand: "visa",
      last4: "4242",
      expiration: "12/2025",
    });
    mockOrganizationService.organizations$.mockReturnValue(of([]));
    mockPremiumOrgUpgradeService.previewProratedInvoice.mockResolvedValue({
      tax: 5.0,
      total: 53.0,
      credit: 10.0,
      newPlanProratedMonths: 1,
    });

    // Mock static form group methods (required for component creation)
    jest.spyOn(EnterPaymentMethodComponent, "getFormGroup").mockReturnValue(
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
      }) as any,
    );

    jest.spyOn(EnterBillingAddressComponent, "getFormGroup").mockReturnValue(
      new FormGroup({
        country: new FormControl<string>("", { nonNullable: true }),
        postalCode: new FormControl<string>("", { nonNullable: true }),
        line1: new FormControl<string | null>(null),
        line2: new FormControl<string | null>(null),
        city: new FormControl<string | null>(null),
        state: new FormControl<string | null>(null),
        taxId: new FormControl<string | null>(null),
      }),
    );

    await TestBed.configureTestingModule({
      imports: [PremiumOrgUpgradePaymentComponent],
      providers: [
        {
          provide: SubscriptionPricingServiceAbstraction,
          useValue: mockSubscriptionPricingService,
        },
        { provide: ToastService, useValue: mockToastService },
        { provide: LogService, useValue: mockLogService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: AccountBillingClient, useValue: mockAccountBillingClient },
        { provide: PreviewInvoiceClient, useValue: mockPreviewInvoiceClient },
        { provide: SubscriberBillingClient, useValue: mockSubscriberBillingClient },
        { provide: AccountService, useValue: mockAccountService },
        { provide: ApiService, useValue: mockApiService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        {
          provide: KeyService,
          useValue: { makeOrgKey: jest.fn().mockResolvedValue(["encrypted-key", "decrypted-key"]) },
        },
        { provide: SyncService, useValue: { fullSync: jest.fn().mockResolvedValue(undefined) } },
      ],
    })
      .overrideComponent(PremiumOrgUpgradePaymentComponent, {
        remove: {
          imports: [DisplayPaymentMethodInlineComponent, CartSummaryComponent],
          providers: [PremiumOrgUpgradeService],
        },
        add: {
          imports: [MockDisplayPaymentMethodInlineComponent, MockCartSummaryComponent],
          providers: [
            { provide: PremiumOrgUpgradeService, useValue: mockPremiumOrgUpgradeService },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PremiumOrgUpgradePaymentComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput("selectedPlanId", "teams" as BusinessSubscriptionPricingTierId);
    fixture.componentRef.setInput("account", mockAccount);
    fixture.detectChanges();

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

  describe("Component Initialization with Different Plans", () => {
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

      expect(component).toBeTruthy();
      expect(component["selectedPlan"]()).not.toBeNull();
      expect(mockToastService.showToast).not.toHaveBeenCalled();
    }));
  });

  describe("submit", () => {
    beforeEach(() => {
      // Set up upgrade service mock for submit tests
      mockPremiumOrgUpgradeService.upgradeToOrganization.mockResolvedValue("new-org-id");
    });

    it("should successfully upgrade to organization", async () => {
      const completeSpy = jest.spyOn(component["complete"], "emit");

      component["formGroup"].setValue({
        organizationName: "My New Org",
        paymentMethodForm: {
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

      expect(mockPremiumOrgUpgradeService.upgradeToOrganization).toHaveBeenCalledWith(
        mockAccount,
        "My New Org",
        component["selectedPlan"](),
        expect.objectContaining({
          country: "US",
          postalCode: "90210",
          line1: "123 Main St",
          city: "Beverly Hills",
          state: "CA",
        }),
      );
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "plansUpdated",
      });
      expect(completeSpy).toHaveBeenCalledWith({
        status: PremiumOrgUpgradePaymentStatus.UpgradedToTeams,
        organizationId: "new-org-id",
      });
    });

    it("should show an error toast if upgrade fails", async () => {
      // Mock processUpgrade to throw an error
      jest
        .spyOn(component as any, "processUpgrade")
        .mockRejectedValue(new Error("Submission Error"));

      component["formGroup"].setValue({
        organizationName: "My New Org",
        paymentMethodForm: {
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

      // Advance time to allow any async operations to complete
      tick(1500);
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
    beforeEach(() => {
      // Set up mocks specific to processUpgrade tests
      mockPremiumOrgUpgradeService.upgradeToOrganization.mockResolvedValue("org-id-123");
      component["paymentMethod"].set({
        type: "card",
        brand: "visa",
        last4: "4242",
        expiration: "12/2025",
      });
    });

    it("should throw error when billing address is incomplete", async () => {
      component["formGroup"].patchValue({
        organizationName: "Test Org",
        billingAddress: {
          country: "",
          postalCode: "",
        },
      });

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

      await expect(component["processUpgrade"]()).rejects.toThrow("Organization name is required");
    });

    it("should update payment method when isChangingPayment returns true", async () => {
      const mockPaymentMethodComponent = {
        isChangingPayment: jest.fn().mockReturnValue(true),
        getTokenizedPaymentMethod: jest.fn().mockResolvedValue({ token: "new-token-123" }),
      };
      jest
        .spyOn(component, "paymentMethodComponent")
        .mockReturnValue(mockPaymentMethodComponent as any);

      const mockSubscriber = { id: "subscriber-123" };
      component["subscriber"].set(mockSubscriber as any);
      component["selectedPlan"].set({
        tier: "teams" as BusinessSubscriptionPricingTierId,
        details: mockTeamsPlan,
        cost: 48,
      });

      component["formGroup"].patchValue({
        organizationName: "Test Organization",
        billingAddress: {
          country: "US",
          postalCode: "12345",
        },
      });

      const result = await component["processUpgrade"]();

      expect(mockPaymentMethodComponent.isChangingPayment).toHaveBeenCalled();
      expect(mockPaymentMethodComponent.getTokenizedPaymentMethod).toHaveBeenCalled();
      expect(mockSubscriberBillingClient.updatePaymentMethod).toHaveBeenCalledWith(
        mockSubscriber,
        { token: "new-token-123" },
        expect.objectContaining({
          country: "US",
          postalCode: "12345",
        }),
      );
      expect(mockPremiumOrgUpgradeService.upgradeToOrganization).toHaveBeenCalledWith(
        mockAccount,
        "Test Organization",
        expect.objectContaining({ tier: "teams" }),
        expect.objectContaining({
          country: "US",
          postalCode: "12345",
        }),
      );
      expect(result.organizationId).toBe("org-id-123");
    });

    it("should not update payment method when isChangingPayment returns false", async () => {
      const mockPaymentMethodComponent = {
        isChangingPayment: jest.fn().mockReturnValue(false),
        getTokenizedPaymentMethod: jest.fn(),
      };
      jest
        .spyOn(component, "paymentMethodComponent")
        .mockReturnValue(mockPaymentMethodComponent as any);
      component["selectedPlan"].set({
        tier: "teams" as BusinessSubscriptionPricingTierId,
        details: mockTeamsPlan,
        cost: 48,
      });

      component["formGroup"].patchValue({
        organizationName: "Test Organization",
        billingAddress: {
          country: "US",
          postalCode: "12345",
        },
      });

      await component["processUpgrade"]();

      expect(mockPaymentMethodComponent.isChangingPayment).toHaveBeenCalled();
      expect(mockPaymentMethodComponent.getTokenizedPaymentMethod).not.toHaveBeenCalled();
      expect(mockSubscriberBillingClient.updatePaymentMethod).not.toHaveBeenCalled();
      expect(mockPremiumOrgUpgradeService.upgradeToOrganization).toHaveBeenCalled();
    });

    it("should handle null paymentMethodComponent gracefully", async () => {
      jest.spyOn(component, "paymentMethodComponent").mockReturnValue(null as any);
      component["selectedPlan"].set({
        tier: "teams" as BusinessSubscriptionPricingTierId,
        details: mockTeamsPlan,
        cost: 48,
      });

      component["formGroup"].patchValue({
        organizationName: "Test Organization",
        billingAddress: {
          country: "US",
          postalCode: "12345",
        },
      });

      await component["processUpgrade"]();

      expect(mockSubscriberBillingClient.updatePaymentMethod).not.toHaveBeenCalled();
      expect(mockPremiumOrgUpgradeService.upgradeToOrganization).toHaveBeenCalled();
    });

    it("should throw error when payment method is null and user is not changing payment", async () => {
      const mockPaymentMethodComponent = {
        isChangingPayment: jest.fn().mockReturnValue(false),
        getTokenizedPaymentMethod: jest.fn(),
      };
      jest
        .spyOn(component, "paymentMethodComponent")
        .mockReturnValue(mockPaymentMethodComponent as any);
      component["paymentMethod"].set(null);
      component["selectedPlan"].set({
        tier: "teams" as BusinessSubscriptionPricingTierId,
        details: mockTeamsPlan,
        cost: 48,
      });

      component["formGroup"].patchValue({
        organizationName: "Test Organization",
        billingAddress: {
          country: "US",
          postalCode: "12345",
        },
      });

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
      jest.spyOn(component as any, "processUpgrade").mockRejectedValue(new Error("Network error"));

      component["formGroup"].setValue({
        organizationName: "My New Org",
        paymentMethodForm: {
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

  describe("Payment Method Initialization", () => {
    it("should set subscriber and payment method signals on init", async () => {
      const subscriber = component["subscriber"]();
      expect(subscriber).toEqual(
        expect.objectContaining({
          type: "account",
          data: expect.objectContaining({
            id: mockAccount.id,
            email: mockAccount.email,
          }),
        }),
      );
      expect(component["paymentMethod"]()).toEqual({
        type: "card",
        brand: "visa",
        last4: "4242",
        expiration: "12/2025",
      });
    });
  });
});
