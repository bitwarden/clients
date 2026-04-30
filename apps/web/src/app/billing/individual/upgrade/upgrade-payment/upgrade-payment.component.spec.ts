import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { FormControl, FormGroup } from "@angular/forms";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, mockReset } from "jest-mock-extended";
import { BehaviorSubject, NEVER, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import { DiscountTierType } from "@bitwarden/common/billing/enums/discount-tier-type.enum";
import { SubscriptionDiscount } from "@bitwarden/common/billing/models/response/subscription-discount.response";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
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

  const mockSubscriptionPricingService = mock<SubscriptionPricingServiceAbstraction>();
  const mockToastService = mock<ToastService>();
  const mockLogService = mock<LogService>();
  const mockSubscriptionDiscountService = mock<SubscriptionDiscountService>();
  const mockUpgradePaymentService = mock<UpgradePaymentService>();
  const mockSubscriberBillingClient = mock<SubscriberBillingClient>();
  const mockAccountService = mock<AccountService>();
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

    discountSubject$ = new BehaviorSubject<SubscriptionDiscount[]>([]);
    mockSubscriptionPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(
      of([mockPremiumTier]),
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
});
