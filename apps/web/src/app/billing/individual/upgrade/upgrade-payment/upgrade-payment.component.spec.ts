import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { FormControl, FormGroup } from "@angular/forms";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, mockReset } from "jest-mock-extended";
import { BehaviorSubject, NEVER, of, Subject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import { DiscountTierType } from "@bitwarden/common/billing/enums/discount-tier-type.enum";
import { SubscriptionDiscount } from "@bitwarden/common/billing/models/response/subscription-discount.response";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierId,
  PersonalSubscriptionPricingTierIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { Cart, DiscountTypes } from "@bitwarden/pricing";

import {
  AccountBillingClient,
  PreviewInvoiceClient,
  SubscriberBillingClient,
} from "../../../clients";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
} from "../../../payment/components";
import { NonTokenizablePaymentMethods } from "../../../payment/types";
import { InvoicePreviewService } from "../../../services/invoice-preview.service";
import { SubscriptionDiscountService } from "../../../services/subscription-discount.service";

import { UpgradePaymentService } from "./services/upgrade-payment.service";
import { UpgradePaymentComponent } from "./upgrade-payment.component";

describe("UpgradePaymentComponent", () => {
  beforeAll(() => {
    global.IntersectionObserver = class {
      constructor() {}
      disconnect() {}
      observe() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      unobserve() {}
    } as any;
  });

  let component: UpgradePaymentComponent;
  let fixture: ComponentFixture<UpgradePaymentComponent>;
  let discountSubject$: BehaviorSubject<SubscriptionDiscount[]>;
  let previewDrivenCartFlag$: BehaviorSubject<boolean>;

  const mockSubscriptionPricingService = mock<SubscriptionPricingServiceAbstraction>();
  const mockToastService = mock<ToastService>();
  const mockLogService = mock<LogService>();
  const mockSubscriptionDiscountService = mock<SubscriptionDiscountService>();
  const mockUpgradePaymentService = mock<UpgradePaymentService>();
  const mockSubscriberBillingClient = mock<SubscriberBillingClient>();
  const mockAccountService = mock<AccountService>();
  const mockConfigService = mock<ConfigService>();
  const mockInvoicePreviewService = mock<InvoicePreviewService>();
  const mockI18nService = { t: jest.fn((key: string) => key) };

  const mockPremiumTier: PersonalSubscriptionPricingTier = {
    id: PersonalSubscriptionPricingTierIds.Premium,
    name: "Premium",
    description: "Premium plan",
    availableCadences: ["annually"],
    passwordManager: {
      type: "standalone",
      annualPrice: 10,
      annualPricePerAdditionalStorageGB: 4,
      features: [],
    },
  };

  const mockFamiliesTier: PersonalSubscriptionPricingTier = {
    id: PersonalSubscriptionPricingTierIds.Families,
    name: "Families",
    description: "Families plan",
    availableCadences: ["annually"],
    passwordManager: {
      type: "packaged",
      users: 6,
      annualPrice: 40,
      annualPricePerAdditionalStorageGB: 4,
      features: [],
    },
  };

  const mockAccount: Account = { id: "user-id" as any, email: "test@example.com" } as Account;

  const mockDiscount: SubscriptionDiscount = {
    stripeCouponId: "coupon-abc",
    percentOff: 20,
    duration: "once",
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-12-31T00:00:00Z",
    tierEligibility: {
      [DiscountTierType.Premium]: true,
      [DiscountTierType.Families]: false,
    },
  };

  const mockUiDiscount = { type: DiscountTypes.PercentOff, value: 20 };

  beforeEach(async () => {
    mockReset(mockSubscriptionPricingService);
    mockReset(mockToastService);
    mockReset(mockLogService);
    mockReset(mockSubscriptionDiscountService);
    mockReset(mockUpgradePaymentService);
    mockReset(mockSubscriberBillingClient);
    mockReset(mockAccountService);
    mockReset(mockConfigService);
    mockReset(mockInvoicePreviewService);

    discountSubject$ = new BehaviorSubject<SubscriptionDiscount[]>([]);
    previewDrivenCartFlag$ = new BehaviorSubject<boolean>(false);
    mockConfigService.getFeatureFlag$.mockImplementation(((flag: FeatureFlag) =>
      flag === FeatureFlag.PM36631_PreviewDrivenCart ? previewDrivenCartFlag$ : of(false)) as any);
    mockSubscriptionPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(
      of([mockPremiumTier, mockFamiliesTier]),
    );
    mockAccountService.activeAccount$ = of(mockAccount);
    mockUpgradePaymentService.userIsOwnerOfFreeOrg$ = of(false);
    mockUpgradePaymentService.adminConsoleRouteForOwnedOrganization$ = of("/org/route");
    mockUpgradePaymentService.accountCredit$ = NEVER;
    mockSubscriptionDiscountService.getEligibleDiscountsForTier$.mockReturnValue(
      discountSubject$.asObservable(),
    );
    mockSubscriptionDiscountService.isDiscountExpiredError.mockReturnValue(false);

    jest.spyOn(EnterPaymentMethodComponent, "getFormGroup").mockReturnValue(
      new FormGroup({
        type: new FormControl("card", { nonNullable: true }),
        bankAccount: new FormGroup({
          routingNumber: new FormControl("", { nonNullable: true }),
          accountNumber: new FormControl("", { nonNullable: true }),
          accountHolderName: new FormControl("", { nonNullable: true }),
          accountHolderType: new FormControl("", { nonNullable: true }),
        }),
        billingAddress: new FormGroup({
          country: new FormControl("", { nonNullable: true }),
          postalCode: new FormControl("", { nonNullable: true }),
        }),
      }) as any,
    );

    jest.spyOn(EnterBillingAddressComponent, "getFormGroup").mockReturnValue(
      new FormGroup({
        country: new FormControl("US", { nonNullable: true }),
        postalCode: new FormControl("12345", { nonNullable: true }),
        line1: new FormControl<string | null>(null),
        line2: new FormControl<string | null>(null),
        city: new FormControl<string | null>(null),
        state: new FormControl<string | null>(null),
        taxId: new FormControl<string | null>(null),
      }),
    );

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, UpgradePaymentComponent],
      providers: [
        {
          provide: SubscriptionPricingServiceAbstraction,
          useValue: mockSubscriptionPricingService,
        },
        { provide: ToastService, useValue: mockToastService },
        { provide: LogService, useValue: mockLogService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: AccountBillingClient, useValue: mock<AccountBillingClient>() },
        { provide: PreviewInvoiceClient, useValue: mock<PreviewInvoiceClient>() },
        { provide: SubscriberBillingClient, useValue: mockSubscriberBillingClient },
        { provide: AccountService, useValue: mockAccountService },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        {
          provide: OrganizationBillingServiceAbstraction,
          useValue: mock<OrganizationBillingServiceAbstraction>(),
        },
        { provide: SyncService, useValue: { fullSync: jest.fn().mockResolvedValue(true) } },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: InvoicePreviewService, useValue: mockInvoicePreviewService },
      ],
    })
      .overrideComponent(UpgradePaymentComponent, {
        remove: { providers: [UpgradePaymentService, SubscriptionDiscountService] },
        add: {
          providers: [
            { provide: UpgradePaymentService, useValue: mockUpgradePaymentService },
            { provide: SubscriptionDiscountService, useValue: mockSubscriptionDiscountService },
          ],
        },
      })
      .overrideComponent(EnterPaymentMethodComponent, {
        set: {
          template: "",
          imports: [],
          providers: [],
        },
      })
      .overrideComponent(EnterBillingAddressComponent, {
        set: {
          template: "",
          imports: [],
          providers: [],
        },
      })
      .compileComponents();

    // Create component outside fakeAsync so debounceTime uses real timers
    fixture = TestBed.createComponent(UpgradePaymentComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput("selectedPlanId", PersonalSubscriptionPricingTierIds.Premium);
    fixture.componentRef.setInput("account", mockAccount);

    // Prevent isFormValid() from calling paymentComponent().validate() during rendering
    jest.spyOn(component as any, "isFormValid").mockReturnValue(false);
  });

  describe("submit — coupon error recovery", () => {
    beforeEach(() => {
      // Re-enable isFormValid so submit actually proceeds
      jest.spyOn(component as any, "isFormValid").mockReturnValue(true);
      // Ensure selectedPlan is set
      (component as any).selectedPlan.set({
        tier: PersonalSubscriptionPricingTierIds.Premium,
        details: {
          id: PersonalSubscriptionPricingTierIds.Premium,
          name: "Premium",
          description: "",
          availableCadences: ["annually"],
          passwordManager: {
            type: "standalone",
            annualPrice: 10,
            annualPricePerAdditionalStorageGB: 4,
            features: [],
          },
        },
      });
    });

    it("calls refresh() and shows retry toast when translateError returns DiscountExpiredError", fakeAsync(async () => {
      fixture.detectChanges();

      const couponError = new ErrorResponse({ Message: "Discount expired." }, 400);
      jest.spyOn(component as any, "processUpgrade").mockRejectedValue(couponError);
      mockSubscriptionDiscountService.isDiscountExpiredError.mockReturnValue(true);

      await component["submit"]();

      expect(mockSubscriptionDiscountService.refresh).toHaveBeenCalled();
      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "warning" }),
      );
    }));

    it("shows generic error toast when translateError returns a non-DiscountExpiredError", fakeAsync(async () => {
      fixture.detectChanges();

      const error = new ErrorResponse({ Message: "Bad request" }, 400);
      jest.spyOn(component as any, "processUpgrade").mockRejectedValue(error);
      // default mockReturnValue(false) means isDiscountExpiredError returns false

      await component["submit"]();

      expect(mockSubscriptionDiscountService.refresh).not.toHaveBeenCalled();
      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    }));
  });

  describe("estimatedTax$ — reactive recalculation", () => {
    it("recalculates tax when billing address changes", fakeAsync(() => {
      const refreshSpy = jest.spyOn(component as any, "refreshSalesTax$").mockReturnValue(of(5));

      fixture.detectChanges();

      // Subscribe within fakeAsync so debounceTime uses fake timers
      const sub = (component as any).estimatedTax$.subscribe();

      // startWith + shareReplay replay both emit synchronously; debounce fires after 1000ms
      tick(1001);
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      refreshSpy.mockClear();

      component.formGroup.controls.billingAddress.patchValue({ country: "CA" });
      tick(1001);

      expect(refreshSpy).toHaveBeenCalledTimes(1);
      sub.unsubscribe();
    }));

    it("recalculates tax when eligible discounts emit", fakeAsync(() => {
      const refreshSpy = jest.spyOn(component as any, "refreshSalesTax$").mockReturnValue(of(5));

      fixture.detectChanges();

      const sub = (component as any).estimatedTax$.subscribe();

      tick(1001);
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      refreshSpy.mockClear();

      discountSubject$.next([mockDiscount]);
      tick(1001);

      expect(refreshSpy).toHaveBeenCalledTimes(1);
      sub.unsubscribe();
    }));

    it("debounces rapid changes from billing address and discounts together", fakeAsync(() => {
      const refreshSpy = jest.spyOn(component as any, "refreshSalesTax$").mockReturnValue(of(5));

      fixture.detectChanges();

      const sub = (component as any).estimatedTax$.subscribe();

      tick(1001);
      refreshSpy.mockClear();

      // Both sources emit within the debounce window — only one recalculation should fire
      component.formGroup.controls.billingAddress.patchValue({ country: "CA" });
      discountSubject$.next([mockDiscount]);
      tick(1001);

      expect(refreshSpy).toHaveBeenCalledTimes(1);
      sub.unsubscribe();
    }));
  });

  describe("cart() computed — discount inclusion", () => {
    it("includes the mapped discount when getEligibleDiscountsForTier$ returns a matching discount", fakeAsync(() => {
      mockSubscriptionDiscountService.mapToCartDiscount.mockReturnValue(mockUiDiscount);

      discountSubject$.next([mockDiscount]);
      fixture.detectChanges();

      const cart: Cart = component["cart"]();
      expect(cart.discounts).toEqual([mockUiDiscount]);
    }));

    it("does not include discounts when getEligibleDiscountsForTier$ returns an empty array", fakeAsync(() => {
      fixture.detectChanges();

      const cart: Cart = component["cart"]();
      expect(cart.discounts).toBeUndefined();
    }));

    it("does not include discounts when mapToCartDiscount returns null", fakeAsync(() => {
      mockSubscriptionDiscountService.mapToCartDiscount.mockReturnValue(null);

      discountSubject$.next([mockDiscount]);
      fixture.detectChanges();

      const cart: Cart = component["cart"]();
      expect(cart.discounts).toBeUndefined();
    }));
  });

  describe("preview-driven cart (PM36631_PreviewDrivenCart)", () => {
    const billingAddress = {
      country: "US",
      postalCode: "12345",
      line1: null,
      line2: null,
      city: null,
      state: null,
      taxId: null,
    };

    const premiumCart: Cart = {
      passwordManager: {
        seats: { translationKey: "premiumMembership", cost: 10, quantity: 1 },
      },
      cadence: "annually",
      discounts: [{ type: DiscountTypes.PercentOff, value: 20, amount: 2, label: "SERVER20" }],
      estimatedTax: 0.64,
      total: 8.64,
    };

    const familiesCart: Cart = {
      passwordManager: {
        seats: { translationKey: "familiesMembership", cost: 40, quantity: 1 },
      },
      cadence: "annually",
      estimatedTax: 3.2,
      total: 43.2,
    };

    const createFixture = (
      planId: PersonalSubscriptionPricingTierId = PersonalSubscriptionPricingTierIds.Premium,
    ) => {
      fixture.destroy();
      fixture = TestBed.createComponent(UpgradePaymentComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput("selectedPlanId", planId);
      fixture.componentRef.setInput("account", mockAccount);
      jest.spyOn(component as any, "isFormValid").mockReturnValue(false);
      fixture.detectChanges();
    };

    const host = (): HTMLElement => fixture.nativeElement;

    const expectFailureState = () => {
      expect(component["previewFailed"]()).toBe(true);
      expect(component["previewCart"]()).toBeNull();
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "invoicePreviewErrorMessage",
      });
      expect(mockLogService.error).toHaveBeenCalled();

      fixture.detectChanges();
      expect(host().querySelector('[data-testid="invoice-preview-error"]')).not.toBeNull();
      expect(host().querySelector("billing-cart-summary")?.classList).toContain("tw-hidden");
    };

    beforeEach(() => {
      previewDrivenCartFlag$.next(true);
      mockUpgradePaymentService.calculateEstimatedTax.mockResolvedValue(3);
      mockInvoicePreviewService.previewPremiumPurchaseCart.mockResolvedValue(premiumCart);
      mockInvoicePreviewService.previewFamiliesPurchaseCart.mockResolvedValue(familiesCart);
    });

    it("previews Premium through the purchase preview service without the legacy tax call", fakeAsync(() => {
      createFixture();
      tick(1001);

      expect(mockInvoicePreviewService.previewPremiumPurchaseCart).toHaveBeenCalledTimes(1);
      expect(mockInvoicePreviewService.previewPremiumPurchaseCart).toHaveBeenCalledWith({
        additionalStorage: 0,
        billingAddress: { country: "US", postalCode: "12345" },
      });
      expect(mockInvoicePreviewService.previewFamiliesPurchaseCart).not.toHaveBeenCalled();
      expect(mockUpgradePaymentService.calculateEstimatedTax).not.toHaveBeenCalled();
    }));

    it("previews Families with the organization purchase request before an organization name is entered", fakeAsync(() => {
      createFixture(PersonalSubscriptionPricingTierIds.Families);
      tick(1001);

      expect(mockInvoicePreviewService.previewFamiliesPurchaseCart).toHaveBeenCalledTimes(1);
      expect(mockInvoicePreviewService.previewFamiliesPurchaseCart).toHaveBeenCalledWith({
        purchase: {
          tier: "families",
          cadence: "annually",
          passwordManager: { seats: 1, additionalStorage: 0, sponsored: false },
        },
        billingAddress,
      });
      expect(component["cart"]()).toBe(familiesCart);
      expect(mockInvoicePreviewService.previewPremiumPurchaseCart).not.toHaveBeenCalled();
      expect(mockUpgradePaymentService.calculateEstimatedTax).not.toHaveBeenCalled();
    }));

    it("forwards eligible coupon ids once the debounce elapses", fakeAsync(() => {
      createFixture();
      tick(1001);
      mockInvoicePreviewService.previewPremiumPurchaseCart.mockClear();

      discountSubject$.next([mockDiscount]);
      tick(1001);

      expect(mockInvoicePreviewService.previewPremiumPurchaseCart).toHaveBeenCalledTimes(1);
      expect(mockInvoicePreviewService.previewPremiumPurchaseCart).toHaveBeenCalledWith({
        additionalStorage: 0,
        billingAddress: { country: "US", postalCode: "12345" },
        coupons: ["coupon-abc"],
      });
    }));

    it("forwards eligible coupon ids inside the Families purchase", fakeAsync(() => {
      createFixture(PersonalSubscriptionPricingTierIds.Families);
      tick(1001);
      mockInvoicePreviewService.previewFamiliesPurchaseCart.mockClear();

      discountSubject$.next([mockDiscount]);
      tick(1001);

      expect(mockInvoicePreviewService.previewFamiliesPurchaseCart).toHaveBeenCalledTimes(1);
      expect(mockInvoicePreviewService.previewFamiliesPurchaseCart).toHaveBeenCalledWith({
        purchase: {
          tier: "families",
          cadence: "annually",
          passwordManager: { seats: 1, additionalStorage: 0, sponsored: false },
          coupons: ["coupon-abc"],
        },
        billingAddress,
      });
    }));

    it("gates account-credit submission on the server cart total", fakeAsync(() => {
      const credit$ = new Subject<number>();
      mockUpgradePaymentService.accountCredit$ = credit$;
      createFixture();
      component.formGroup.controls.paymentForm.patchValue({
        type: NonTokenizablePaymentMethods.accountCredit,
      });
      tick(1001);
      fixture.detectChanges();
      tick();

      let hasEnough: boolean | undefined;
      const subscription = component["hasEnoughAccountCredit$"].subscribe((value) => {
        hasEnough = value;
      });
      credit$.next(8);
      expect(hasEnough).toBe(false);

      credit$.next(9);
      expect(hasEnough).toBe(true);
      subscription.unsubscribe();
    }));

    it("clears the failure state when the billing address becomes incomplete", fakeAsync(() => {
      mockInvoicePreviewService.previewPremiumPurchaseCart.mockRejectedValueOnce(
        new Error("preview failed"),
      );
      createFixture();
      tick(1001);
      expect(component["previewFailed"]()).toBe(true);

      component.formGroup.controls.billingAddress.patchValue({ postalCode: "" });
      tick(1001);
      fixture.detectChanges();

      expect(component["previewFailed"]()).toBe(false);
      expect(mockInvoicePreviewService.previewPremiumPurchaseCart).toHaveBeenCalledTimes(1);
      expect(host().querySelector('[data-testid="invoice-preview-error"]')).toBeNull();
      expect(host().querySelector("billing-cart-summary")?.classList).not.toContain("tw-hidden");
    }));

    it("renders the server cart verbatim without merging client-side discounts", fakeAsync(() => {
      mockSubscriptionDiscountService.mapToCartDiscount.mockReturnValue(mockUiDiscount);
      discountSubject$.next([mockDiscount]);

      createFixture();
      tick(1001);

      const cart: Cart = component["cart"]();
      expect(cart).toBe(premiumCart);
      expect(cart.discounts).toEqual(premiumCart.discounts);
      expect(cart.discounts).not.toContainEqual(mockUiDiscount);
    }));

    it.each([
      ["404 flag off or route not deployed", new ErrorResponse({ Message: "Not Found" }, 404)],
      ["404 missing Premium plan", new ErrorResponse({ Message: "Plan not found" }, 404)],
      [
        "409 catalog fault",
        new ErrorResponse(
          {
            Message: "The plan could not be previewed. Please contact support for assistance.",
          },
          409,
        ),
      ],
      [
        "400 keyed field",
        new ErrorResponse(
          { Message: "Invalid", ValidationErrors: { PostalCode: ["Postal code is required."] } },
          400,
        ),
      ],
      ["network error", new Error("Failed to fetch")],
    ])("takes the same failure path for a %s", (_, error) =>
      fakeAsync(() => {
        mockInvoicePreviewService.previewPremiumPurchaseCart.mockRejectedValue(error);

        createFixture();
        tick(1001);

        expectFailureState();
      })(),
    );

    it("toasts once per failed preview", fakeAsync(() => {
      mockInvoicePreviewService.previewPremiumPurchaseCart.mockRejectedValue(
        new Error("preview failed"),
      );

      createFixture();
      tick(1001);
      component.formGroup.controls.billingAddress.patchValue({ postalCode: "54321" });
      tick(1001);

      expect(mockInvoicePreviewService.previewPremiumPurchaseCart).toHaveBeenCalledTimes(2);
      expect(mockToastService.showToast).toHaveBeenCalledTimes(2);
      expect(mockToastService.showToast).toHaveBeenNthCalledWith(2, {
        variant: "error",
        message: "invoicePreviewErrorMessage",
      });
    }));

    it("clears the failure state once a later preview succeeds", fakeAsync(() => {
      mockInvoicePreviewService.previewPremiumPurchaseCart
        .mockRejectedValueOnce(new Error("preview failed"))
        .mockResolvedValue(premiumCart);

      createFixture();
      tick(1001);
      expect(component["previewFailed"]()).toBe(true);

      component.formGroup.controls.billingAddress.patchValue({ postalCode: "54321" });
      tick(1001);

      expect(component["previewFailed"]()).toBe(false);
      expect(component["previewCart"]()).toBe(premiumCart);

      fixture.detectChanges();
      expect(host().querySelector('[data-testid="invoice-preview-error"]')).toBeNull();
      expect(host().querySelector("billing-cart-summary")?.classList).not.toContain("tw-hidden");
    }));

    it("ignores a stale preview that resolves after a newer one", fakeAsync(() => {
      const staleCart: Cart = { ...premiumCart, total: 1 };
      let resolveFirst!: (cart: Cart) => void;
      mockInvoicePreviewService.previewPremiumPurchaseCart
        .mockImplementationOnce(() => new Promise<Cart>((resolve) => (resolveFirst = resolve)))
        .mockResolvedValue(premiumCart);

      createFixture();
      tick(1001);

      component.formGroup.controls.billingAddress.patchValue({ postalCode: "54321" });
      tick(1001);
      expect(component["previewCart"]()).toBe(premiumCart);

      resolveFirst(staleCart);
      tick();

      expect(component["previewCart"]()).toBe(premiumCart);
    }));

    it("clears the server cart while the billing address is incomplete", fakeAsync(() => {
      createFixture();
      tick(1001);
      expect(component["previewCart"]()).toBe(premiumCart);

      component.formGroup.controls.billingAddress.patchValue({ postalCode: "" });
      tick(1001);

      expect(mockInvoicePreviewService.previewPremiumPurchaseCart).toHaveBeenCalledTimes(1);
      expect(component["previewCart"]()).toBeNull();
      expect(component["previewFailed"]()).toBe(false);
    }));

    it("falls back to the legacy tax call when the flag turns off at runtime", fakeAsync(() => {
      createFixture();
      tick(1001);
      expect(component["previewCart"]()).toBe(premiumCart);

      previewDrivenCartFlag$.next(false);
      tick(1001);

      expect(component["previewCart"]()).toBeNull();
      expect(component["previewFailed"]()).toBe(false);
      expect(mockUpgradePaymentService.calculateEstimatedTax).toHaveBeenCalledTimes(1);
    }));

    it("never calls the preview service with the flag off and keeps the legacy tax call", fakeAsync(() => {
      previewDrivenCartFlag$.next(false);

      createFixture();
      tick(1001);

      expect(mockInvoicePreviewService.previewPremiumPurchaseCart).not.toHaveBeenCalled();
      expect(mockInvoicePreviewService.previewFamiliesPurchaseCart).not.toHaveBeenCalled();
      expect(mockUpgradePaymentService.calculateEstimatedTax).toHaveBeenCalledTimes(1);
      expect(mockUpgradePaymentService.calculateEstimatedTax).toHaveBeenCalledWith(
        { tier: PersonalSubscriptionPricingTierIds.Premium, details: mockPremiumTier },
        billingAddress,
        [],
      );
      expect(component["cart"]().estimatedTax).toBe(3);
    }));
  });
});
