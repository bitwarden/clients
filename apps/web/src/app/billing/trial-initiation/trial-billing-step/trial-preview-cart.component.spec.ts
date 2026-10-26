// Disabled for the stubbed cart-summary child that still uses an @Input.
/* eslint-disable @angular-eslint/prefer-signals */
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed } from "@angular/core/testing";
import { mock, mockReset } from "jest-mock-extended";

import { SubscriptionDiscount } from "@bitwarden/common/billing/models/response/subscription-discount.response";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Cart, CartSummaryComponent } from "@bitwarden/pricing";
import { BillingNotificationService } from "@bitwarden/web-vault/app/billing/services/billing-notification.service";

import { TrialBillingStepService } from "./trial-billing-step.service";
import { TrialPreviewCartComponent } from "./trial-preview-cart.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "billing-cart-summary",
  template: "",
  standalone: true,
})
class MockCartSummaryComponent {
  @Input() cart: Cart | undefined;
}

describe("TrialPreviewCartComponent", () => {
  let fixture: ComponentFixture<TrialPreviewCartComponent>;
  let component: TrialPreviewCartComponent;

  const mockTrialBillingStepService = mock<TrialBillingStepService>();
  const mockBillingNotificationService = mock<BillingNotificationService>();
  const mockI18nService = { t: jest.fn((key: string) => key) };

  const mockTrial = {
    organization: { name: "Test Org", email: "test@example.com" },
    product: "passwordManager" as const,
    tier: "enterprise" as const,
    length: 0,
  };
  const validAddress = { country: "US", postalCode: "12345" } as any;
  const mockCart = {
    passwordManager: {
      seats: { translationKey: "passwordManagerPlanPrice", quantity: 10, cost: 72 },
    },
    cadence: "annually",
    estimatedTax: 153.6,
    total: 2073.6,
  } as Cart;

  beforeEach(async () => {
    mockReset(mockTrialBillingStepService);
    mockReset(mockBillingNotificationService);

    await TestBed.configureTestingModule({
      imports: [TrialPreviewCartComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: TrialBillingStepService, useValue: mockTrialBillingStepService },
        { provide: BillingNotificationService, useValue: mockBillingNotificationService },
      ],
    })
      .overrideComponent(TrialPreviewCartComponent, {
        remove: { imports: [CartSummaryComponent] },
        add: { imports: [MockCartSummaryComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TrialPreviewCartComponent);
    component = fixture.componentInstance;
  });

  const setInputs = (overrides: Record<string, unknown> = {}) => {
    fixture.componentRef.setInput("trial", mockTrial);
    fixture.componentRef.setInput("cadence", "annually");
    fixture.componentRef.setInput("billingAddress", validAddress);
    fixture.componentRef.setInput("eligibleDiscounts", []);
    Object.entries(overrides).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
  };

  it("previews the purchase and renders the cart summary", fakeAsync(() => {
    mockTrialBillingStepService.previewPurchase.mockResolvedValue(mockCart);

    setInputs();
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();

    expect(mockTrialBillingStepService.previewPurchase).toHaveBeenCalledWith(
      mockTrial,
      "annually",
      validAddress,
      [],
    );
    expect(component["preview"].value()).toBe(mockCart);
    expect(fixture.nativeElement.querySelector("billing-cart-summary")).toBeTruthy();
  }));

  it("refetches when the cadence changes", fakeAsync(() => {
    mockTrialBillingStepService.previewPurchase.mockResolvedValue(mockCart);

    setInputs();
    fixture.detectChanges();
    flushMicrotasks();
    expect(mockTrialBillingStepService.previewPurchase).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput("cadence", "monthly");
    fixture.detectChanges();
    flushMicrotasks();

    expect(mockTrialBillingStepService.previewPurchase).toHaveBeenCalledTimes(2);
    expect(mockTrialBillingStepService.previewPurchase.mock.calls[1][1]).toBe("monthly");
  }));

  it("refetches when the billing address changes", fakeAsync(() => {
    mockTrialBillingStepService.previewPurchase.mockResolvedValue(mockCart);

    setInputs();
    fixture.detectChanges();
    flushMicrotasks();

    fixture.componentRef.setInput("billingAddress", { country: "US", postalCode: "67890" });
    fixture.detectChanges();
    flushMicrotasks();

    expect(mockTrialBillingStepService.previewPurchase).toHaveBeenCalledTimes(2);
    expect(mockTrialBillingStepService.previewPurchase.mock.calls[1][2]).toEqual({
      country: "US",
      postalCode: "67890",
    });
  }));

  it("does not preview until the billing address is valid", fakeAsync(() => {
    setInputs({ billingAddress: { country: "US" } });
    fixture.detectChanges();
    flushMicrotasks();

    expect(mockTrialBillingStepService.previewPurchase).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector("billing-cart-summary")).toBeNull();
  }));

  it("does not preview a trial", fakeAsync(() => {
    setInputs({ trial: { ...mockTrial, length: 7 } });
    fixture.detectChanges();
    flushMicrotasks();

    expect(mockTrialBillingStepService.previewPurchase).not.toHaveBeenCalled();
  }));

  it("passes eligible discounts' stripe coupon ids to the preview", fakeAsync(() => {
    mockTrialBillingStepService.previewPurchase.mockResolvedValue(mockCart);

    setInputs({ eligibleDiscounts: [{ stripeCouponId: "coupon-1" } as SubscriptionDiscount] });
    fixture.detectChanges();
    flushMicrotasks();

    expect(mockTrialBillingStepService.previewPurchase).toHaveBeenCalledWith(
      expect.anything(),
      "annually",
      validAddress,
      ["coupon-1"],
    );
  }));

  it("shows a spinner while loading, then the cart", fakeAsync(() => {
    let resolvePreview!: (cart: Cart) => void;
    mockTrialBillingStepService.previewPurchase.mockReturnValue(
      new Promise<Cart>((resolve) => {
        resolvePreview = resolve;
      }),
    );

    setInputs();
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector("bit-spinner")).toBeTruthy();
    expect(fixture.nativeElement.querySelector("billing-cart-summary")).toBeNull();

    resolvePreview(mockCart);
    flushMicrotasks();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector("bit-spinner")).toBeNull();
    expect(fixture.nativeElement.querySelector("billing-cart-summary")).toBeTruthy();
  }));

  it("notifies and shows a generic callout with a Try again link when the preview fails", fakeAsync(() => {
    mockTrialBillingStepService.previewPurchase.mockRejectedValue(new Error("preview failed"));

    setInputs();
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();

    expect(mockBillingNotificationService.showError).toHaveBeenCalledWith(
      "invoicePreviewErrorMessage",
    );
    expect(component.hasError()).toBe(true);
    const callout = fixture.nativeElement.querySelector("bit-callout");
    expect(callout.textContent).toContain("invoicePreviewErrorMessage");
    expect(
      fixture.nativeElement.querySelector("#trial-preview-cart_button_retry-preview"),
    ).toBeTruthy();
  }));

  it("retries the preview from the Try again link and recovers", fakeAsync(() => {
    let attempts = 0;
    mockTrialBillingStepService.previewPurchase.mockImplementation(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("preview failed");
      }
      return mockCart;
    });

    setInputs();
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("bit-callout")).toBeTruthy();

    (
      fixture.nativeElement.querySelector(
        "#trial-preview-cart_button_retry-preview",
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();

    expect(mockTrialBillingStepService.previewPurchase).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector("bit-callout")).toBeNull();
    expect(fixture.nativeElement.querySelector("billing-cart-summary")).toBeTruthy();
  }));

  it("shows the invalid-address callout without a Try again link for a 400 failure", fakeAsync(() => {
    mockTrialBillingStepService.previewPurchase.mockRejectedValue(
      new ErrorResponse({ Message: "Bad address" }, 400),
    );

    setInputs();
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();

    expect(mockBillingNotificationService.showError).toHaveBeenCalledWith(
      "billingPreviewInvalidAddressError",
    );
    const callout = fixture.nativeElement.querySelector("bit-callout");
    expect(callout.textContent).toContain("billingPreviewInvalidAddressError");
    expect(
      fixture.nativeElement.querySelector("#trial-preview-cart_button_retry-preview"),
    ).toBeNull();
  }));
});
