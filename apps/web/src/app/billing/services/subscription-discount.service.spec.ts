import { TestBed } from "@angular/core/testing";
import { mock, mockReset } from "jest-mock-extended";
import { firstValueFrom, of, toArray } from "rxjs";
import { take } from "rxjs/operators";

import { DiscountTierType } from "@bitwarden/common/billing/enums/discount-tier-type.enum";
import { SubscriptionDiscountEligibility } from "@bitwarden/common/billing/models/response/subscription-discount-eligibility.response";
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

const makeApplicableDiscounts = (
  cartLevelDiscounts: SubscriptionDiscount[] = [],
  itemLevelDiscounts: SubscriptionDiscount[] = [],
): SubscriptionDiscountEligibility => ({ cartLevelDiscounts, itemLevelDiscounts });

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

  describe("getCartLevelDiscountsForTier$", () => {
    it("returns mapped Discount objects for cart-level discounts eligible for the given tier", async () => {
      const discount = makeDiscount({ percentOff: 20 });
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts.mockResolvedValue(
        makeApplicableDiscounts([discount], []),
      );

      const result = await firstValueFrom(
        sut.getCartLevelDiscountsForTier$(DiscountTierType.Premium),
      );

      expect(result).toEqual([{ type: DiscountTypes.PercentOff, value: 20 }]);
    });

    it("filters to only cart-level discounts eligible for the given tier", async () => {
      const eligible = makeDiscount({
        stripeCouponId: "eligible",
        tierEligibility: { [DiscountTierType.Premium]: true, [DiscountTierType.Families]: false },
      });
      const ineligible = makeDiscount({
        stripeCouponId: "ineligible",
        tierEligibility: { [DiscountTierType.Premium]: false, [DiscountTierType.Families]: true },
      });
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts.mockResolvedValue(
        makeApplicableDiscounts([eligible, ineligible], []),
      );

      const result = await firstValueFrom(
        sut.getCartLevelDiscountsForTier$(DiscountTierType.Premium),
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: DiscountTypes.PercentOff, value: 20 });
    });

    it("returns empty array when feature flag is disabled", async () => {
      mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

      const result = await firstValueFrom(
        sut.getCartLevelDiscountsForTier$(DiscountTierType.Premium),
      );

      expect(mockAccountBillingClient.getApplicableDiscounts).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("shares a single API call across simultaneous subscribers", async () => {
      const discounts = makeApplicableDiscounts([makeDiscount()], []);
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts.mockResolvedValue(discounts);

      const sub1 = sut.getCartLevelDiscountsForTier$(DiscountTierType.Premium).subscribe();
      const sub2 = sut.getItemLevelDiscountsForTier$(DiscountTierType.Premium).subscribe();
      await new Promise((r) => setTimeout(r));

      sub1.unsubscribe();
      sub2.unsubscribe();

      expect(mockAccountBillingClient.getApplicableDiscounts).toHaveBeenCalledTimes(1);
    });

    it("re-fetches from the API when refresh() is called and emits the updated discounts", async () => {
      const first = makeApplicableDiscounts([makeDiscount({ stripeCouponId: "first" })], []);
      const second = makeApplicableDiscounts([makeDiscount({ stripeCouponId: "second" })], []);
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts
        .mockResolvedValueOnce(first)
        .mockResolvedValueOnce(second);

      const resultsPromise = firstValueFrom(
        sut.getCartLevelDiscountsForTier$(DiscountTierType.Premium).pipe(take(2), toArray()),
      );

      await Promise.resolve();
      sut.refresh();
      await Promise.resolve();

      const results = await resultsPromise;
      expect(mockAccountBillingClient.getApplicableDiscounts).toHaveBeenCalledTimes(2);
      expect(results[0]).toHaveLength(1);
      expect(results[1]).toHaveLength(1);
    });

    it("checks the PM29108_EnablePersonalDiscounts feature flag", async () => {
      mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

      await firstValueFrom(sut.getCartLevelDiscountsForTier$(DiscountTierType.Premium));

      expect(mockConfigService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.PM29108_EnablePersonalDiscounts,
      );
    });
  });

  describe("getItemLevelDiscountsForTier$", () => {
    it("returns mapped Discount objects for item-level discounts eligible for the given tier", async () => {
      const discount = makeDiscount({ amountOff: 500, percentOff: undefined });
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts.mockResolvedValue(
        makeApplicableDiscounts([], [discount]),
      );

      const result = await firstValueFrom(
        sut.getItemLevelDiscountsForTier$(DiscountTierType.Premium),
      );

      expect(result).toEqual([{ type: DiscountTypes.AmountOff, value: 5 }]);
    });

    it("filters to only item-level discounts eligible for the given tier", async () => {
      const eligible = makeDiscount({
        stripeCouponId: "eligible",
        tierEligibility: { [DiscountTierType.Premium]: true, [DiscountTierType.Families]: false },
      });
      const ineligible = makeDiscount({
        stripeCouponId: "ineligible",
        tierEligibility: { [DiscountTierType.Premium]: false, [DiscountTierType.Families]: true },
      });
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts.mockResolvedValue(
        makeApplicableDiscounts([], [eligible, ineligible]),
      );

      const result = await firstValueFrom(
        sut.getItemLevelDiscountsForTier$(DiscountTierType.Premium),
      );

      expect(result).toHaveLength(1);
    });

    it("returns empty array when feature flag is disabled", async () => {
      mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

      const result = await firstValueFrom(
        sut.getItemLevelDiscountsForTier$(DiscountTierType.Premium),
      );

      expect(mockAccountBillingClient.getApplicableDiscounts).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe("getAllEligibleSubscriptionDiscountsForTier$", () => {
    it("returns SubscriptionDiscount objects (with stripeCouponId) for the given tier across both levels", async () => {
      const cartDiscount = makeDiscount({
        stripeCouponId: "cart-coupon",
        tierEligibility: { [DiscountTierType.Premium]: true, [DiscountTierType.Families]: false },
      });
      const itemDiscount = makeDiscount({
        stripeCouponId: "item-coupon",
        tierEligibility: { [DiscountTierType.Premium]: true, [DiscountTierType.Families]: false },
      });
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts.mockResolvedValue(
        makeApplicableDiscounts([cartDiscount], [itemDiscount]),
      );

      const result = await firstValueFrom(
        sut.getAllEligibleSubscriptionDiscountsForTier$(DiscountTierType.Premium),
      );

      expect(result).toHaveLength(2);
      expect(result.find((d) => d.stripeCouponId === "cart-coupon")).toBeDefined();
      expect(result.find((d) => d.stripeCouponId === "item-coupon")).toBeDefined();
    });

    it("filters to only discounts eligible for the given tier", async () => {
      const premiumDiscount = makeDiscount({
        stripeCouponId: "premium",
        tierEligibility: { [DiscountTierType.Premium]: true, [DiscountTierType.Families]: false },
      });
      const familiesDiscount = makeDiscount({
        stripeCouponId: "families",
        tierEligibility: { [DiscountTierType.Premium]: false, [DiscountTierType.Families]: true },
      });
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts.mockResolvedValue(
        makeApplicableDiscounts([premiumDiscount, familiesDiscount], []),
      );

      const result = await firstValueFrom(
        sut.getAllEligibleSubscriptionDiscountsForTier$(DiscountTierType.Premium),
      );

      expect(result).toHaveLength(1);
      expect(result[0].stripeCouponId).toBe("premium");
    });

    it("returns an empty array when there are no discounts", async () => {
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
      mockAccountBillingClient.getApplicableDiscounts.mockResolvedValue(
        makeApplicableDiscounts([], []),
      );

      const result = await firstValueFrom(
        sut.getAllEligibleSubscriptionDiscountsForTier$(DiscountTierType.Premium),
      );

      expect(result).toEqual([]);
    });

    it("returns an empty array when the feature flag is disabled", async () => {
      mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

      const result = await firstValueFrom(
        sut.getAllEligibleSubscriptionDiscountsForTier$(DiscountTierType.Premium),
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
});
