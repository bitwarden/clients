import { TestBed } from "@angular/core/testing";
import { mock, mockReset } from "jest-mock-extended";
import { firstValueFrom, of, toArray } from "rxjs";
import { take } from "rxjs/operators";

import { DiscountTierType } from "@bitwarden/common/billing/enums/discount-tier-type.enum";
import { SubscriptionDiscount } from "@bitwarden/common/billing/models/response/subscription-discount.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { DiscountTypes } from "@bitwarden/pricing";

import { AccountBillingClient } from "../clients/account-billing.client";

import { SubscriptionDiscountService } from "./subscription-discount.service";

const makeDiscount = (overrides: Partial<SubscriptionDiscount> = {}): SubscriptionDiscount => ({
  stripeCouponId: "coupon-abc",
  percentOff: 20,
  duration: "once",
  startDate: "2026-01-01T00:00:00Z",
  endDate: "2026-12-31T00:00:00Z",
  tierEligibility: { [DiscountTierType.Premium]: true, [DiscountTierType.Families]: false },
  ...overrides,
});

describe("SubscriptionDiscountService", () => {
  const mockAccountBillingClient = mock<AccountBillingClient>();
  const mockConfigService = mock<ConfigService>();

  let sut: SubscriptionDiscountService;

  beforeEach(() => {
    mockReset(mockAccountBillingClient);
    mockReset(mockConfigService);
    TestBed.configureTestingModule({
      providers: [
        SubscriptionDiscountService,
        { provide: AccountBillingClient, useValue: mockAccountBillingClient },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    });
    sut = TestBed.inject(SubscriptionDiscountService);
  });

  describe("getEligibleDiscounts$", () => {
    it("delegates to AccountBillingClient and returns the result when the feature flag is enabled", async () => {
      const discounts = [makeDiscount()];
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts.mockResolvedValue(discounts);

      const result = await firstValueFrom(sut.getEligibleDiscounts$());

      expect(mockAccountBillingClient.getApplicableDiscounts).toHaveBeenCalled();
      expect(result).toBe(discounts);
    });

    it("does not call the API for the initial fetch when the cache is already warm", async () => {
      const discounts = [makeDiscount()];
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts.mockResolvedValue(discounts);

      // First subscription: cache miss → 1 API call
      const sub1 = sut.getEligibleDiscounts$().subscribe();
      await new Promise((r) => setTimeout(r));
      sub1.unsubscribe();

      // Second subscription: cache hit → 0 additional API calls
      const sub2 = sut.getEligibleDiscounts$().subscribe();
      await new Promise((r) => setTimeout(r));
      sub2.unsubscribe();

      expect(mockAccountBillingClient.getApplicableDiscounts).toHaveBeenCalledTimes(1);
    });

    it("re-fetches from the API when refresh() is called and emits the updated discounts", async () => {
      const first = [makeDiscount({ stripeCouponId: "first" })];
      const second = [makeDiscount({ stripeCouponId: "second" })];
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts
        .mockResolvedValueOnce(first)
        .mockResolvedValueOnce(second);

      // take(2) completes after the initial emission + the refresh emission
      const resultsPromise = firstValueFrom(sut.getEligibleDiscounts$().pipe(take(2), toArray()));

      await Promise.resolve(); // allow initial fetch to resolve
      sut.refresh();
      await Promise.resolve(); // allow refresh fetch to resolve

      const results = await resultsPromise;

      expect(mockAccountBillingClient.getApplicableDiscounts).toHaveBeenCalledTimes(2);
      expect(results[0]).toBe(first);
      expect(results[1]).toBe(second);
    });

    it("caches the refreshed results so subsequent subscriptions skip the initial fetch", async () => {
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts.mockResolvedValue([makeDiscount()]);

      // Keep a live subscription and call refresh
      const sub = sut.getEligibleDiscounts$().subscribe();
      await new Promise((r) => setTimeout(r)); // let initial fetch settle
      sut.refresh();
      await new Promise((r) => setTimeout(r)); // let refresh fetch settle
      sub.unsubscribe();
      const callsAfterRefresh = (mockAccountBillingClient.getApplicableDiscounts as jest.Mock).mock
        .calls.length;

      // New subscription: cache hit → no additional API calls
      const sub2 = sut.getEligibleDiscounts$().subscribe();
      await new Promise((r) => setTimeout(r));
      sub2.unsubscribe();

      expect(mockAccountBillingClient.getApplicableDiscounts).toHaveBeenCalledTimes(
        callsAfterRefresh,
      );
    });

    it("returns an empty array and does not call AccountBillingClient when the feature flag is disabled", async () => {
      mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

      const result = await firstValueFrom(sut.getEligibleDiscounts$());

      expect(mockAccountBillingClient.getApplicableDiscounts).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("checks the PM29108_EnablePersonalDiscounts feature flag", async () => {
      mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

      await firstValueFrom(sut.getEligibleDiscounts$());

      expect(mockConfigService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.PM29108_EnablePersonalDiscounts,
      );
    });
  });

  describe("getEligibleDiscountsForTier$", () => {
    it("returns discounts eligible for the Premium tier", async () => {
      const discount = makeDiscount({
        tierEligibility: { [DiscountTierType.Premium]: true, [DiscountTierType.Families]: false },
      });
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts.mockResolvedValue([discount]);

      const result = await firstValueFrom(
        sut.getEligibleDiscountsForTier$(DiscountTierType.Premium),
      );

      expect(result).toEqual([discount]);
    });

    it("returns discounts eligible for the Families tier", async () => {
      const discount = makeDiscount({
        tierEligibility: { [DiscountTierType.Premium]: false, [DiscountTierType.Families]: true },
      });
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts.mockResolvedValue([discount]);

      const result = await firstValueFrom(
        sut.getEligibleDiscountsForTier$(DiscountTierType.Families),
      );

      expect(result).toEqual([discount]);
    });

    it("excludes discounts where tierEligibility for the tier is false", async () => {
      const discount = makeDiscount({
        tierEligibility: { [DiscountTierType.Premium]: false, [DiscountTierType.Families]: true },
      });
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts.mockResolvedValue([discount]);

      const result = await firstValueFrom(
        sut.getEligibleDiscountsForTier$(DiscountTierType.Premium),
      );

      expect(result).toEqual([]);
    });

    it("returns an empty array when there are no discounts", async () => {
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts.mockResolvedValue([]);

      const result = await firstValueFrom(
        sut.getEligibleDiscountsForTier$(DiscountTierType.Premium),
      );

      expect(result).toEqual([]);
    });

    it("returns an empty array when the feature flag is disabled", async () => {
      mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

      const result = await firstValueFrom(
        sut.getEligibleDiscountsForTier$(DiscountTierType.Premium),
      );

      expect(mockAccountBillingClient.getApplicableDiscounts).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe("isDiscountExpiredError", () => {
    it("returns true for a 400 ErrorResponse with the discount expired message", () => {
      const error = new ErrorResponse(
        { Message: "Discount expired. Please review your cart total and try again" },
        400,
      );
      expect(sut.isDiscountExpiredError(error)).toBe(true);
    });

    it("returns false for a 400 ErrorResponse with a different message", () => {
      const error = new ErrorResponse({ Message: "Bad request" }, 400);
      expect(sut.isDiscountExpiredError(error)).toBe(false);
    });

    it("returns false for a non-400 ErrorResponse with the discount expired message", () => {
      const error = new ErrorResponse(
        { Message: "Discount expired. Please review your cart total and try again" },
        500,
      );
      expect(sut.isDiscountExpiredError(error)).toBe(false);
    });

    it("returns false for a non-ErrorResponse error", () => {
      const error = new Error("Something went wrong");
      expect(sut.isDiscountExpiredError(error)).toBe(false);
    });
  });

  describe("mapToCartDiscount", () => {
    it("maps percentOff to DiscountTypes.PercentOff with correct value", () => {
      const discount = makeDiscount({ percentOff: 20, amountOff: undefined });
      const result = sut.mapToCartDiscount(discount);
      expect(result).toEqual({ type: DiscountTypes.PercentOff, value: 20 });
    });

    it("maps amountOff (cents) to DiscountTypes.AmountOff with dollar value", () => {
      const discount = makeDiscount({ percentOff: undefined, amountOff: 500 });
      const result = sut.mapToCartDiscount(discount);
      expect(result).toEqual({ type: DiscountTypes.AmountOff, value: 5 });
    });

    it("returns null when both percentOff and amountOff are absent", () => {
      const discount = makeDiscount({ percentOff: undefined, amountOff: undefined });
      const result = sut.mapToCartDiscount(discount);
      expect(result).toBeNull();
    });
  });
});
