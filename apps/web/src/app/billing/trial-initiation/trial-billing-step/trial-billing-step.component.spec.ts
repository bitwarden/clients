// These are disabled until we can migrate to signals and remove the use of @Input properties in mocked child components
/* eslint-disable @angular-eslint/prefer-signals */
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed } from "@angular/core/testing";
import { FormBuilder, FormControl } from "@angular/forms";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, mockReset } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { DiscountTierType } from "@bitwarden/common/billing/enums/discount-tier-type.enum";
import { SubscriptionDiscount } from "@bitwarden/common/billing/models/response/subscription-discount.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";
import { Cart, CartSummaryComponent, DiscountTypes } from "@bitwarden/pricing";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
} from "@bitwarden/web-vault/app/billing/payment/components";
import { BillingNotificationService } from "@bitwarden/web-vault/app/billing/services/billing-notification.service";
import { SubscriptionDiscountService } from "@bitwarden/web-vault/app/billing/services/subscription-discount.service";

import { TrialBillingStepComponent } from "./trial-billing-step.component";
import { TrialBillingStepService } from "./trial-billing-step.service";
import { TrialPreviewCartComponent } from "./trial-preview-cart.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-enter-payment-method",
  template: "",
  standalone: true,
})
class MockEnterPaymentMethodComponent {
  @Input() group: any;

  static getFormGroup() {
    return new FormBuilder().group({
      type: new FormControl("card"),
      bankAccount: new FormBuilder().group({
        routingNumber: new FormControl(""),
        accountNumber: new FormControl(""),
        accountHolderName: new FormControl(""),
        accountHolderType: new FormControl(""),
      }),
      billingAddress: new FormBuilder().group({
        country: new FormControl("US"),
        postalCode: new FormControl(""),
      }),
    });
  }

  tokenize = jest.fn().mockResolvedValue({ token: "tok_test", type: "card" });
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "billing-cart-summary",
  template: "",
  standalone: true,
})
class MockCartSummaryComponent {
  @Input() cart: Cart | undefined;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-enter-billing-address",
  template: "",
  standalone: true,
})
class MockEnterBillingAddressComponent {
  @Input() group: any;
  @Input() scenario: any;

  static getFormGroup() {
    return new FormBuilder().group({
      country: new FormControl("US"),
      postalCode: new FormControl("12345"),
      taxId: new FormControl(""),
      line1: new FormControl(""),
      line2: new FormControl(""),
      city: new FormControl(""),
      state: new FormControl(""),
    });
  }
}

describe("TrialBillingStepComponent", () => {
  let component: TrialBillingStepComponent;
  let fixture: ComponentFixture<TrialBillingStepComponent>;
  let discountSubject$: BehaviorSubject<SubscriptionDiscount[]>;
  let pamBillingSupport$: BehaviorSubject<boolean>;
  let previewDrivenCart$: BehaviorSubject<boolean>;

  const mockTrialBillingStepService = mock<TrialBillingStepService>();
  const mockSubscriptionDiscountService = mock<SubscriptionDiscountService>();
  const mockToastService = mock<ToastService>();
  const mockConfigService = mock<ConfigService>();
  const mockBillingNotificationService = mock<BillingNotificationService>();
  const mockI18nService = { t: jest.fn((key: string) => key) };

  const mockCart = {
    passwordManager: {
      seats: { translationKey: "passwordManagerPlanPrice", quantity: 10, cost: 72 },
    },
    cadence: "annually",
    estimatedTax: 153.6,
    total: 2073.6,
  } as Cart;

  // A direct purchase: the shape the preview cart prices.
  const mockDirectPurchase = {
    organization: { name: "Test Org", email: "test@example.com" },
    product: "passwordManager" as const,
    tier: "enterprise" as const,
    length: 0,
  };

  const mockFamiliesDiscount: SubscriptionDiscount = {
    stripeCouponId: "coupon-families",
    percentOff: 20,
    duration: "once",
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-12-31T00:00:00Z",
    tierEligibility: {
      [DiscountTierType.Premium]: false,
      [DiscountTierType.Families]: true,
    },
  };

  const mockUiDiscount = { type: DiscountTypes.PercentOff, value: 20 };

  const mockFamiliesTrial = {
    organization: { name: "Test Org", email: "test@example.com" },
    product: "passwordManager" as const,
    tier: "families" as const,
    length: 0,
  };

  const mockTeamsTrial = {
    organization: { name: "Test Org", email: "test@example.com" },
    product: "passwordManager" as const,
    tier: "teams" as const,
    length: 0,
  };

  beforeEach(async () => {
    mockReset(mockTrialBillingStepService);
    mockReset(mockSubscriptionDiscountService);
    mockReset(mockToastService);
    mockReset(mockConfigService);
    mockReset(mockBillingNotificationService);

    pamBillingSupport$ = new BehaviorSubject<boolean>(false);
    previewDrivenCart$ = new BehaviorSubject<boolean>(false);
    mockConfigService.getFeatureFlag$.mockImplementation((flag: FeatureFlag) => {
      switch (flag) {
        case FeatureFlag.PamBillingSupport:
          return pamBillingSupport$;
        case FeatureFlag.PM36631_PreviewDrivenCart:
          return previewDrivenCart$;
        default:
          return of(false);
      }
    });

    discountSubject$ = new BehaviorSubject<SubscriptionDiscount[]>([]);
    mockSubscriptionDiscountService.mapToCartDiscount.mockReturnValue(null);
    mockSubscriptionDiscountService.isDiscountExpiredError.mockReturnValue(false);
    mockTrialBillingStepService.getPrices$.mockReturnValue(of({ annually: 40 }));
    mockTrialBillingStepService.getCosts.mockResolvedValue({ tax: 0, total: 40 });
    // The component subscribes immediately; the discount-badge tests drive the subject.
    mockTrialBillingStepService.getEligibleDiscounts$.mockReturnValue(
      discountSubject$.asObservable(),
    );

    // Spy on static methods before component instantiation
    jest
      .spyOn(EnterPaymentMethodComponent, "getFormGroup")
      .mockReturnValue(MockEnterPaymentMethodComponent.getFormGroup() as any);
    jest
      .spyOn(EnterBillingAddressComponent, "getFormGroup")
      .mockReturnValue(MockEnterBillingAddressComponent.getFormGroup() as any);

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, TrialBillingStepComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: ToastService, useValue: mockToastService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TrialBillingStepService, useValue: mockTrialBillingStepService },
        { provide: SubscriptionDiscountService, useValue: mockSubscriptionDiscountService },
        { provide: BillingNotificationService, useValue: mockBillingNotificationService },
      ],
    })
      .overrideComponent(TrialBillingStepComponent, {
        remove: {
          imports: [EnterPaymentMethodComponent, EnterBillingAddressComponent],
          providers: [TrialBillingStepService, SubscriptionDiscountService],
        },
        add: {
          imports: [MockEnterPaymentMethodComponent, MockEnterBillingAddressComponent],
        },
      })
      // The real preview cart renders so the parent's @ViewChild gate resolves; stub only its
      // cart-summary grandchild.
      .overrideComponent(TrialPreviewCartComponent, {
        remove: { imports: [CartSummaryComponent] },
        add: { imports: [MockCartSummaryComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TrialBillingStepComponent);
    component = fixture.componentInstance;
  });

  describe("discountTierType", () => {
    it("returns Families when tier is families", fakeAsync(() => {
      fixture.componentRef.setInput("trial", mockFamiliesTrial);
      fixture.detectChanges();

      expect(component["discountTierType"]()).toBe(DiscountTierType.Families);
    }));

    it("returns null when tier is teams", fakeAsync(() => {
      fixture.componentRef.setInput("trial", mockTeamsTrial);
      fixture.detectChanges();

      expect(component["discountTierType"]()).toBeNull();
    }));
  });

  describe("eligibleDiscounts", () => {
    it("contains matching discounts when tier is families and discounts are available", fakeAsync(() => {
      fixture.componentRef.setInput("trial", mockFamiliesTrial);
      fixture.detectChanges();

      discountSubject$.next([mockFamiliesDiscount]);
      fixture.detectChanges();

      expect(component["eligibleDiscounts"]()).toEqual([mockFamiliesDiscount]);
    }));

    it("is empty when tier is teams", fakeAsync(() => {
      fixture.componentRef.setInput("trial", mockTeamsTrial);
      fixture.detectChanges();

      expect(component["eligibleDiscounts"]()).toEqual([]);
    }));

    it("is empty when service returns empty array", fakeAsync(() => {
      fixture.componentRef.setInput("trial", mockFamiliesTrial);
      discountSubject$.next([]);
      fixture.detectChanges();

      expect(component["eligibleDiscounts"]()).toEqual([]);
    }));
  });

  describe("cartDiscounts", () => {
    it("maps percentOff discount to PercentOff Discount correctly", fakeAsync(() => {
      mockSubscriptionDiscountService.mapToCartDiscount.mockReturnValue(mockUiDiscount);

      fixture.componentRef.setInput("trial", mockFamiliesTrial);
      fixture.detectChanges();

      discountSubject$.next([mockFamiliesDiscount]);
      fixture.detectChanges();

      expect(component["cartDiscounts"]()).toEqual([mockUiDiscount]);
    }));

    it("is empty when mapToCartDiscount returns null", fakeAsync(() => {
      mockSubscriptionDiscountService.mapToCartDiscount.mockReturnValue(null);

      fixture.componentRef.setInput("trial", mockFamiliesTrial);
      discountSubject$.next([mockFamiliesDiscount]);
      fixture.detectChanges();

      expect(component["cartDiscounts"]()).toEqual([]);
    }));
  });

  describe("preview cart wiring", () => {
    const enableFlags = () => {
      pamBillingSupport$.next(true);
      previewDrivenCart$.next(true);
    };

    it("renders the preview cart and hides the legacy price block when both flags are on", fakeAsync(() => {
      enableFlags();
      mockTrialBillingStepService.previewPurchase.mockResolvedValue(mockCart);

      fixture.componentRef.setInput("trial", mockDirectPurchase);
      fixture.detectChanges();
      flushMicrotasks();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("app-trial-preview-cart")).toBeTruthy();
      expect(fixture.nativeElement.querySelector("billing-cart-summary")).toBeTruthy();
      expect(fixture.nativeElement.querySelector("#price")).toBeNull();
    }));

    it("renders the legacy radios and price block when a flag is off", fakeAsync(() => {
      mockTrialBillingStepService.getPrices$.mockReturnValue(of({ annually: 40, monthly: 2 }));

      fixture.componentRef.setInput("trial", mockDirectPurchase);
      fixture.detectChanges();
      flushMicrotasks();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("app-trial-preview-cart")).toBeNull();
      expect(fixture.nativeElement.querySelector("#price")).toBeTruthy();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain("$40.00"); // legacy annual radio price
      expect(text).toContain("$2.00"); // legacy monthly radio price
    }));

    it("disables submit while the preview cart is erroring", fakeAsync(() => {
      enableFlags();
      mockTrialBillingStepService.previewPurchase.mockRejectedValue(new Error("preview failed"));

      fixture.componentRef.setInput("trial", mockDirectPurchase);
      fixture.detectChanges();
      flushMicrotasks();
      fixture.detectChanges();
      flushMicrotasks();

      expect(component["previewErrored"]()).toBe(true);
      // bit-button reflects disabled as aria-disabled, not the native attribute.
      const submit = fixture.nativeElement.querySelector("button[type='submit']");
      expect(submit.getAttribute("aria-disabled")).toBe("true");
    }));

    it("hides the header discount badges when the preview cart is showing", fakeAsync(() => {
      // The cart summary renders its own discount badges, so the header would double up.
      enableFlags();
      mockSubscriptionDiscountService.mapToCartDiscount.mockReturnValue(mockUiDiscount);
      mockTrialBillingStepService.previewPurchase.mockResolvedValue(mockCart);

      fixture.componentRef.setInput("trial", mockFamiliesTrial);
      fixture.detectChanges();
      discountSubject$.next([mockFamiliesDiscount]);
      flushMicrotasks();
      fixture.detectChanges();

      expect(component["cartDiscounts"]()).toEqual([mockUiDiscount]);
      expect(fixture.nativeElement.querySelector("billing-discount-badge")).toBeNull();
    }));

    it("shows the header discount badges on the legacy path", fakeAsync(() => {
      mockSubscriptionDiscountService.mapToCartDiscount.mockReturnValue(mockUiDiscount);

      fixture.componentRef.setInput("trial", mockFamiliesTrial);
      fixture.detectChanges();
      discountSubject$.next([mockFamiliesDiscount]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("billing-discount-badge")).toBeTruthy();
    }));
  });

  describe("submit — coupon error recovery", () => {
    const setupSubmit = (discounts: any[]) => {
      fixture.componentRef.setInput("trial", mockFamiliesTrial);
      fixture.detectChanges();

      // Mock the signal directly after detectChanges (avoids @ViewChild reset issues)
      (component as any).eligibleDiscounts = jest.fn(() => discounts);

      // Mock the enterPaymentMethodComponent view-child signal after final detectChanges
      Object.defineProperty(component, "enterPaymentMethodComponent", {
        value: () => ({ tokenize: jest.fn().mockResolvedValue({ token: "tok", type: "card" }) }),
        configurable: true,
        writable: true,
      });

      component["formGroup"].controls.billingAddress.patchValue({
        country: "US",
        postalCode: "12345",
        taxId: "",
        line1: "",
        line2: "",
        city: "",
        state: "",
      });
    };

    it("calls refresh() and shows warning toast when translateError returns DiscountExpiredError", async () => {
      setupSubmit([mockFamiliesDiscount]);

      const couponError = new ErrorResponse({ Message: "Discount expired." }, 400);
      mockTrialBillingStepService.startTrial.mockRejectedValue(couponError);
      mockSubscriptionDiscountService.isDiscountExpiredError.mockReturnValue(true);

      await component["submit"]();

      expect(mockSubscriptionDiscountService.refresh).toHaveBeenCalled();
      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "warning" }),
      );
    });

    it("rethrows error when translateError returns a non-DiscountExpiredError", async () => {
      setupSubmit([]);

      const error = new ErrorResponse({ Message: "Bad request" }, 400);
      mockTrialBillingStepService.startTrial.mockRejectedValue(error);
      // default mockReturnValue(false) means isDiscountExpiredError returns false

      let thrownError: unknown;
      try {
        await component["submit"]();
      } catch (e) {
        thrownError = e;
      }

      expect(thrownError).toBeInstanceOf(ErrorResponse);
      expect(mockSubscriptionDiscountService.refresh).not.toHaveBeenCalled();
    });

    it("passes coupons to startTrial when eligibleDiscounts is non-empty", async () => {
      setupSubmit([mockFamiliesDiscount]);

      mockTrialBillingStepService.startTrial.mockResolvedValue({ id: "org-123" } as any);
      mockTrialBillingStepService.getPrices$.mockReturnValue(of({ annually: 40 }));

      await component["submit"]();

      expect(mockTrialBillingStepService.startTrial).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        ["coupon-families"],
      );
    });

    it("passes empty coupons array to startTrial when eligibleDiscounts is empty", async () => {
      setupSubmit([]);

      mockTrialBillingStepService.startTrial.mockResolvedValue({ id: "org-123" } as any);

      await component["submit"]();

      expect(mockTrialBillingStepService.startTrial).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        [],
      );
    });
  });
});
