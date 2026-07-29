import { DiscountTierType } from "../../enums/discount-tier-type.enum";

import { SubscriptionDiscountResponse } from "./subscription-discount.response";

type RawDiscountResponse = {
  StripeCouponId: string;
  PercentOff: number | null;
  AmountOff: number | null;
  Currency: string | null;
  Duration: string;
  DurationInMonths: number | null;
  Name: string;
  StartDate: string;
  EndDate: string;
  TierEligibility: Record<DiscountTierType, boolean> | null;
};

describe("SubscriptionDiscountResponse", () => {
  const baseResponse: RawDiscountResponse = {
    StripeCouponId: "coupon-abc",
    PercentOff: 20,
    AmountOff: null,
    Currency: null,
    Duration: "once",
    DurationInMonths: null,
    Name: "Test Coupon",
    StartDate: "2026-01-01T00:00:00Z",
    EndDate: "2026-12-31T00:00:00Z",
    TierEligibility: { [DiscountTierType.Premium]: true, [DiscountTierType.Families]: false },
  };

  it("deserializes stripeCouponId correctly", () => {
    const sut = new SubscriptionDiscountResponse(baseResponse);
    expect(sut.stripeCouponId).toBe("coupon-abc");
  });

  it("deserializes percentOff correctly", () => {
    const sut = new SubscriptionDiscountResponse(baseResponse);
    expect(sut.percentOff).toBe(20);
  });

  it("deserializes amountOff correctly", () => {
    const response: RawDiscountResponse = { ...baseResponse, AmountOff: 500, PercentOff: null };
    const sut = new SubscriptionDiscountResponse(response);
    expect(sut.amountOff).toBe(500);
  });

  it("preserves amountOff in cents (no conversion)", () => {
    const response: RawDiscountResponse = { ...baseResponse, AmountOff: 1000, PercentOff: null };
    const sut = new SubscriptionDiscountResponse(response);
    expect(sut.amountOff).toBe(1000);
  });

  it("deserializes tierEligibility with Premium=true and Families=false", () => {
    const sut = new SubscriptionDiscountResponse(baseResponse);
    expect(sut.tierEligibility[DiscountTierType.Premium]).toBe(true);
    expect(sut.tierEligibility[DiscountTierType.Families]).toBe(false);
  });

  it("deserializes tierEligibility with both tiers true", () => {
    const response = {
      ...baseResponse,
      TierEligibility: { [DiscountTierType.Premium]: true, [DiscountTierType.Families]: true },
    };
    const sut = new SubscriptionDiscountResponse(response);
    expect(sut.tierEligibility[DiscountTierType.Premium]).toBe(true);
    expect(sut.tierEligibility[DiscountTierType.Families]).toBe(true);
  });

  it("deserializes tierEligibility with both tiers false", () => {
    const response = {
      ...baseResponse,
      TierEligibility: { [DiscountTierType.Premium]: false, [DiscountTierType.Families]: false },
    };
    const sut = new SubscriptionDiscountResponse(response);
    expect(sut.tierEligibility[DiscountTierType.Premium]).toBe(false);
    expect(sut.tierEligibility[DiscountTierType.Families]).toBe(false);
  });

  it("stores null for tierEligibility when TierEligibility is null in response", () => {
    const response: RawDiscountResponse = { ...baseResponse, TierEligibility: null };
    const sut = new SubscriptionDiscountResponse(response);
    expect(sut.tierEligibility).toBeNull();
  });

  it("leaves percentOff undefined when null in response", () => {
    const response: RawDiscountResponse = { ...baseResponse, PercentOff: null };
    const sut = new SubscriptionDiscountResponse(response);
    expect(sut.percentOff).toBeUndefined();
  });

  it("leaves amountOff undefined when null in response", () => {
    const sut = new SubscriptionDiscountResponse(baseResponse);
    expect(sut.amountOff).toBeUndefined();
  });
});
