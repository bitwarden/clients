import { DatePipe } from "@angular/common";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock, mockReset } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";

import { OrganizationBillingClient } from "../clients";

import { ChurnMitigationOfferDialogResultType } from "./churn-mitigation-offer-dialog.component";
import { OrganizationSubscriptionCloudComponent } from "./organization-subscription-cloud.component";

function makeDialogRef<R>(result: R): Pick<DialogRef<R>, "closed"> {
  return { closed: of(result) };
}

describe("OrganizationSubscriptionCloudComponent.cancelSubscription", () => {
  const mockDialogService = mock<DialogService>();
  const mockOrganizationBillingClient = mock<OrganizationBillingClient>();
  const mockOrganizationApiService = mock<OrganizationApiServiceAbstraction>();
  const mockI18nService = mock<I18nService>();
  const mockLogService = mock<LogService>();
  const mockOrganizationService = mock<OrganizationService>();
  const mockAccountService = mock<AccountService>();
  const mockApiService = mock<ApiService>();
  const mockToastService = mock<ToastService>();
  const mockOrganizationUserApiService = mock<OrganizationUserApiService>();
  const mockDatePipe = mock<DatePipe>();

  let component: OrganizationSubscriptionCloudComponent;

  const orgId = "org-abc";

  const mockOffer = {
    couponId: "CHURN25",
    percentOff: 25,
    duration: "repeating",
    durationInMonths: 12,
    name: "Loyalty Discount",
  } as any;

  const mockSub = {
    plan: { type: 9, productTier: 3, isAnnual: true },
    subscription: { periodEndDate: "2026-12-31" },
  } as any;

  beforeEach(() => {
    mockReset(mockDialogService);
    mockReset(mockOrganizationBillingClient);

    TestBed.configureTestingModule({
      providers: [
        OrganizationSubscriptionCloudComponent,
        { provide: ApiService, useValue: mockApiService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: LogService, useValue: mockLogService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: OrganizationApiServiceAbstraction, useValue: mockOrganizationApiService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              params: {},
              queryParams: {},
              queryParamMap: { get: (_key: string): string | null => null },
            },
          },
        },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ToastService, useValue: mockToastService },
        { provide: OrganizationUserApiService, useValue: mockOrganizationUserApiService },
        { provide: DatePipe, useValue: mockDatePipe },
        { provide: OrganizationBillingClient, useValue: mockOrganizationBillingClient },
      ],
    });

    component = TestBed.inject(OrganizationSubscriptionCloudComponent);
    component.organizationId = orgId;
    component.sub = mockSub;
  });

  describe("eligible org (offer returned)", () => {
    beforeEach(() => {
      mockOrganizationBillingClient.getChurnOffer.mockResolvedValue(mockOffer);
    });

    it("opens the churn-offer dialog instead of the offboarding survey directly", async () => {
      mockDialogService.open.mockReturnValue(
        makeDialogRef(ChurnMitigationOfferDialogResultType.Closed) as any,
      );

      await component.cancelSubscription();

      expect(mockOrganizationBillingClient.getChurnOffer).toHaveBeenCalledWith(orgId);
      // First dialog open call should be for the churn dialog (not the offboarding survey)
      expect(mockDialogService.open).toHaveBeenCalledTimes(1);
    });

    it("calls load() and returns when user accepts the offer", async () => {
      mockDialogService.open.mockReturnValue(
        makeDialogRef(ChurnMitigationOfferDialogResultType.Accepted) as any,
      );
      const loadSpy = jest.spyOn(component, "load" as any).mockResolvedValue(undefined);

      await component.cancelSubscription();

      expect(loadSpy).toHaveBeenCalled();
      // Only one dialog opened — the churn dialog; offboarding survey never opened
      expect(mockDialogService.open).toHaveBeenCalledTimes(1);
    });

    it("opens the offboarding survey when user declines the offer", async () => {
      mockDialogService.open
        .mockReturnValueOnce(makeDialogRef(ChurnMitigationOfferDialogResultType.Declined) as any)
        .mockReturnValueOnce(makeDialogRef("closed") as any);

      await component.cancelSubscription();

      expect(mockDialogService.open).toHaveBeenCalledTimes(2);
    });

    it("does not open offboarding survey when user closes the churn dialog without choosing", async () => {
      mockDialogService.open.mockReturnValue(
        makeDialogRef(ChurnMitigationOfferDialogResultType.Closed) as any,
      );

      await component.cancelSubscription();

      expect(mockDialogService.open).toHaveBeenCalledTimes(1);
    });

    it("calls load() after the offboarding survey is submitted", async () => {
      mockDialogService.open
        .mockReturnValueOnce(makeDialogRef(ChurnMitigationOfferDialogResultType.Declined) as any)
        .mockReturnValueOnce(makeDialogRef("submitted") as any);
      const loadSpy = jest.spyOn(component, "load" as any).mockResolvedValue(undefined);

      await component.cancelSubscription();

      expect(loadSpy).toHaveBeenCalled();
    });
  });

  describe("ineligible org (no offer returned)", () => {
    beforeEach(() => {
      mockOrganizationBillingClient.getChurnOffer.mockResolvedValue(null);
    });

    it("opens the offboarding survey directly without opening the churn-offer dialog", async () => {
      mockDialogService.open.mockReturnValue(makeDialogRef("closed") as any);

      await component.cancelSubscription();

      expect(mockOrganizationBillingClient.getChurnOffer).toHaveBeenCalledWith(orgId);
      expect(mockDialogService.open).toHaveBeenCalledTimes(1);
    });

    it("calls load() when the offboarding survey is submitted", async () => {
      mockDialogService.open.mockReturnValue(makeDialogRef("submitted") as any);
      const loadSpy = jest.spyOn(component, "load" as any).mockResolvedValue(undefined);

      await component.cancelSubscription();

      expect(loadSpy).toHaveBeenCalled();
    });

    it("does not call load() when the offboarding survey is closed without submitting", async () => {
      mockDialogService.open.mockReturnValue(makeDialogRef("closed") as any);
      const loadSpy = jest.spyOn(component, "load" as any).mockResolvedValue(undefined);

      await component.cancelSubscription();

      expect(loadSpy).not.toHaveBeenCalled();
    });
  });
});

describe("OrganizationSubscriptionCloudComponent.discountPrice", () => {
  const mockApiService = mock<ApiService>();
  const mockI18nService = mock<I18nService>();
  const mockLogService = mock<LogService>();
  const mockOrganizationService = mock<OrganizationService>();
  const mockAccountService = mock<AccountService>();
  const mockOrganizationApiService = mock<OrganizationApiServiceAbstraction>();
  const mockDialogService = mock<DialogService>();
  const mockToastService = mock<ToastService>();
  const mockOrganizationUserApiService = mock<OrganizationUserApiService>();
  const mockDatePipe = mock<DatePipe>();
  const mockOrganizationBillingClient = mock<OrganizationBillingClient>();

  let component: OrganizationSubscriptionCloudComponent;

  const setCustomerDiscount = (customerDiscount: any) => {
    component.sub = { customerDiscount } as any;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        OrganizationSubscriptionCloudComponent,
        { provide: ApiService, useValue: mockApiService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: LogService, useValue: mockLogService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: OrganizationApiServiceAbstraction, useValue: mockOrganizationApiService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              params: {},
              queryParams: {},
              queryParamMap: { get: (_key: string): string | null => null },
            },
          },
        },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ToastService, useValue: mockToastService },
        { provide: OrganizationUserApiService, useValue: mockOrganizationUserApiService },
        { provide: DatePipe, useValue: mockDatePipe },
        { provide: OrganizationBillingClient, useValue: mockOrganizationBillingClient },
      ],
    });

    component = TestBed.inject(OrganizationSubscriptionCloudComponent);
  });

  it("reduces by percentage for a perpetual percent discount that applies", () => {
    setCustomerDiscount({ active: true, percentOff: 20, appliesTo: [] });

    expect(component.discountPrice(100)).toBe(80);
  });

  it("reduces a repeating percent discount despite active === false", () => {
    setCustomerDiscount({ active: false, percentOff: 10, durationInMonths: 12, appliesTo: [] });

    expect(component.discountPrice(100)).toBe(90);
  });

  it("leaves the per-unit price unchanged for an amount-off discount (applied at the line total)", () => {
    // A fixed amount applies once to the line total, not per seat, so the per-unit price is full.
    setCustomerDiscount({ active: true, amountOff: 15, appliesTo: [] });

    const result = component.discountPrice(7);

    expect(result).toBe(7);
    expect(Number.isNaN(result)).toBe(false);
  });

  it("returns the full price (not NaN) when neither percent nor amount is set", () => {
    setCustomerDiscount({ active: true, appliesTo: [] });

    const result = component.discountPrice(100);

    expect(result).toBe(100);
    expect(Number.isNaN(result)).toBe(false);
  });

  it("does not reduce when the percent discount is scoped to a different product", () => {
    setCustomerDiscount({ active: true, percentOff: 20, appliesTo: ["prod_x"] });

    expect(component.discountPrice(100, "prod_y")).toBe(100);
  });

  it("returns the full price when there is no customer discount", () => {
    setCustomerDiscount(null);

    expect(component.discountPrice(100)).toBe(100);
  });
});

describe("OrganizationSubscriptionCloudComponent.subscriptionLineItems (discounted line totals)", () => {
  const mockApiService = mock<ApiService>();
  const mockI18nService = mock<I18nService>();
  const mockLogService = mock<LogService>();
  const mockOrganizationService = mock<OrganizationService>();
  const mockAccountService = mock<AccountService>();
  const mockOrganizationApiService = mock<OrganizationApiServiceAbstraction>();
  const mockDialogService = mock<DialogService>();
  const mockToastService = mock<ToastService>();
  const mockOrganizationUserApiService = mock<OrganizationUserApiService>();
  const mockDatePipe = mock<DatePipe>();
  const mockOrganizationBillingClient = mock<OrganizationBillingClient>();

  let component: OrganizationSubscriptionCloudComponent;

  const lineItem = (overrides: Record<string, unknown> = {}) =>
    ({
      productId: "prod_seats",
      name: "Members",
      amount: 7,
      quantity: 10,
      interval: "month",
      sponsoredSubscriptionItem: false,
      addonSubscriptionItem: false,
      productName: "passwordManager",
      ...overrides,
    }) as any;

  const setup = (customerDiscount: any, lineItems: any[]) => {
    component.sub = { customerDiscount } as any;
    component.lineItems = lineItems;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        OrganizationSubscriptionCloudComponent,
        { provide: ApiService, useValue: mockApiService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: LogService, useValue: mockLogService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: OrganizationApiServiceAbstraction, useValue: mockOrganizationApiService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              params: {},
              queryParams: {},
              queryParamMap: { get: (_key: string): string | null => null },
            },
          },
        },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ToastService, useValue: mockToastService },
        { provide: OrganizationUserApiService, useValue: mockOrganizationUserApiService },
        { provide: DatePipe, useValue: mockDatePipe },
        { provide: OrganizationBillingClient, useValue: mockOrganizationBillingClient },
      ],
    });

    component = TestBed.inject(OrganizationSubscriptionCloudComponent);
  });

  it("subtracts a fixed amount-off once from the multi-seat line total (10 x $7 - $15 = $55)", () => {
    setup({ active: true, amountOff: 15, appliesTo: [] }, [lineItem({ amount: 7, quantity: 10 })]);

    const [item] = component.subscriptionLineItems;

    expect(item.amount).toBe(7); // per-unit price stays at full value
    expect(item.discountedTotal).toBe(55);
    expect(item.discounted).toBe(true);
  });

  it("subtracts a fixed amount-off from a single-seat annual line total (1 x $72 - $15 = $57)", () => {
    setup({ active: true, amountOff: 15, appliesTo: [] }, [
      lineItem({ amount: 72, quantity: 1, interval: "year" }),
    ]);

    const [item] = component.subscriptionLineItems;

    expect(item.discountedTotal).toBe(57);
  });

  it("applies a percentage discount across the whole multi-seat line total (10 x $7 @ 10% = $63)", () => {
    setup({ active: true, percentOff: 10, appliesTo: [] }, [lineItem({ amount: 7, quantity: 10 })]);

    const [item] = component.subscriptionLineItems;

    expect(item.discountedTotal).toBe(63);
  });

  it("clamps the line total to zero when the fixed amount-off exceeds it ($500 off $70 = $0)", () => {
    setup({ active: true, amountOff: 500, appliesTo: [] }, [lineItem({ amount: 7, quantity: 10 })]);

    const [item] = component.subscriptionLineItems;

    expect(item.discountedTotal).toBe(0);
  });

  it("reduces a repeating amount-off line total despite active === false", () => {
    setup({ active: false, amountOff: 15, durationInMonths: 12, appliesTo: [] }, [
      lineItem({ amount: 7, quantity: 10 }),
    ]);

    const [item] = component.subscriptionLineItems;

    expect(item.discountedTotal).toBe(55);
  });

  it("applies a fixed amount-off once across multiple lines, not per line", () => {
    setup({ active: true, amountOff: 15, appliesTo: [] }, [
      lineItem({ productId: "prod_seats", amount: 7, quantity: 10 }),
      lineItem({ productId: "prod_storage", amount: 4, quantity: 5 }),
    ]);

    const [first, second] = component.subscriptionLineItems;

    // $15 consumed entirely by the first line (10 x $7 - $15 = $55); the second line is untouched.
    expect(first.discountedTotal).toBe(55);
    expect(second.discountedTotal).toBe(20);
    // The fully-consumed second line was not reduced, so it must not render a strikethrough/qualifier.
    expect(first.discounted).toBe(true);
    expect(second.discounted).toBe(false);
  });

  it("marks a line the discount does not apply to as not discounted", () => {
    setup({ active: true, amountOff: 15, appliesTo: ["prod_seats"] }, [
      lineItem({ productId: "prod_seats", amount: 7, quantity: 10 }),
      lineItem({ productId: "prod_storage", amount: 4, quantity: 5 }),
    ]);

    const [first, second] = component.subscriptionLineItems;

    expect(first.discounted).toBe(true); // reduced to $55
    expect(second.discounted).toBe(false); // product-scoped out, stays at full $20
  });

  it("leaves the line total at full value when there is no discount", () => {
    setup(null, [lineItem({ amount: 7, quantity: 10 })]);

    const [item] = component.subscriptionLineItems;

    expect(item.discountedTotal).toBe(70);
    expect(item.discounted).toBe(false);
  });
});

describe("OrganizationSubscriptionCloudComponent.discountAppliesToProduct", () => {
  const mockApiService = mock<ApiService>();
  const mockI18nService = mock<I18nService>();
  const mockLogService = mock<LogService>();
  const mockOrganizationService = mock<OrganizationService>();
  const mockAccountService = mock<AccountService>();
  const mockOrganizationApiService = mock<OrganizationApiServiceAbstraction>();
  const mockDialogService = mock<DialogService>();
  const mockToastService = mock<ToastService>();
  const mockOrganizationUserApiService = mock<OrganizationUserApiService>();
  const mockDatePipe = mock<DatePipe>();
  const mockOrganizationBillingClient = mock<OrganizationBillingClient>();

  let component: OrganizationSubscriptionCloudComponent;

  const setCustomerDiscount = (customerDiscount: any) => {
    component.sub = { customerDiscount } as any;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        OrganizationSubscriptionCloudComponent,
        { provide: ApiService, useValue: mockApiService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: LogService, useValue: mockLogService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: OrganizationApiServiceAbstraction, useValue: mockOrganizationApiService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              params: {},
              queryParams: {},
              queryParamMap: { get: (_key: string): string | null => null },
            },
          },
        },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ToastService, useValue: mockToastService },
        { provide: OrganizationUserApiService, useValue: mockOrganizationUserApiService },
        { provide: DatePipe, useValue: mockDatePipe },
        { provide: OrganizationBillingClient, useValue: mockOrganizationBillingClient },
      ],
    });

    component = TestBed.inject(OrganizationSubscriptionCloudComponent);
  });

  it("returns true for an empty appliesTo (whole-subscription discount)", () => {
    setCustomerDiscount({ active: true, amountOff: 15, appliesTo: [] });

    expect(component.discountAppliesToProduct("prod_anything")).toBe(true);
  });

  it("returns true for a product included in a scoped appliesTo", () => {
    setCustomerDiscount({ active: true, amountOff: 15, appliesTo: ["prod_x"] });

    expect(component.discountAppliesToProduct("prod_x")).toBe(true);
  });

  it("returns false for a product not included in a scoped appliesTo", () => {
    setCustomerDiscount({ active: true, amountOff: 15, appliesTo: ["prod_x"] });

    expect(component.discountAppliesToProduct("prod_y")).toBe(false);
  });

  it("returns true for an empty appliesTo even when there is no discount value set", () => {
    setCustomerDiscount({ active: true, appliesTo: [] });

    expect(component.discountAppliesToProduct("prod_anything")).toBe(true);
  });
});

describe("OrganizationSubscriptionCloudComponent.discountDurationLabel", () => {
  const mockApiService = mock<ApiService>();
  const mockI18nService = mock<I18nService>();
  const mockLogService = mock<LogService>();
  const mockOrganizationService = mock<OrganizationService>();
  const mockAccountService = mock<AccountService>();
  const mockOrganizationApiService = mock<OrganizationApiServiceAbstraction>();
  const mockDialogService = mock<DialogService>();
  const mockToastService = mock<ToastService>();
  const mockOrganizationUserApiService = mock<OrganizationUserApiService>();
  const mockDatePipe = mock<DatePipe>();
  const mockOrganizationBillingClient = mock<OrganizationBillingClient>();

  let component: OrganizationSubscriptionCloudComponent;

  const setCustomerDiscount = (customerDiscount: any) => {
    component.sub = { customerDiscount } as any;
  };

  beforeEach(() => {
    // Echo the i18n key + args so assertions check the key/args, not the (design-pending) copy.
    mockI18nService.t.mockImplementation(
      (key: string, p1?: string | number) => (p1 != null ? `${key}:${p1}` : key) as string,
    );

    TestBed.configureTestingModule({
      providers: [
        OrganizationSubscriptionCloudComponent,
        { provide: ApiService, useValue: mockApiService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: LogService, useValue: mockLogService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: OrganizationApiServiceAbstraction, useValue: mockOrganizationApiService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              params: {},
              queryParams: {},
              queryParamMap: { get: (_key: string): string | null => null },
            },
          },
        },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ToastService, useValue: mockToastService },
        { provide: OrganizationUserApiService, useValue: mockOrganizationUserApiService },
        { provide: DatePipe, useValue: mockDatePipe },
        { provide: OrganizationBillingClient, useValue: mockOrganizationBillingClient },
      ],
    });

    component = TestBed.inject(OrganizationSubscriptionCloudComponent);
  });

  it("returns the one-year key for a 12-month repeating discount", () => {
    setCustomerDiscount({ active: false, percentOff: 10, durationInMonths: 12, appliesTo: [] });

    expect(component.discountDurationLabel()).toBe("discountForOneYear");
  });

  it("returns the months key with the count for a non-12-month repeating discount", () => {
    setCustomerDiscount({ active: false, percentOff: 10, durationInMonths: 6, appliesTo: [] });

    expect(component.discountDurationLabel()).toBe("discountForMonths:6");
  });

  it("returns null when durationInMonths is absent (e.g. only an end date)", () => {
    setCustomerDiscount({ active: false, percentOff: 10, end: "2027-06-01", appliesTo: [] });

    expect(component.discountDurationLabel()).toBeNull();
  });

  it("returns null when there is no customer discount", () => {
    setCustomerDiscount(null);

    expect(component.discountDurationLabel()).toBeNull();
  });
});
