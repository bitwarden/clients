import { mock, mockReset } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { AccountBillingClient } from "./account-billing.client";

describe("AccountBillingClient", () => {
  const mockApiService = mock<ApiService>();

  let sut: AccountBillingClient;

  beforeEach(() => {
    mockReset(mockApiService);
    sut = new AccountBillingClient(mockApiService);
  });

  describe("purchaseSubscription", () => {
    it("includes coupons in request body when provided", async () => {
      const paymentMethod = { token: "tok_123", type: "card" } as any;
      const billingAddress = { country: "US", postalCode: "12345" };
      mockApiService.send.mockResolvedValue(undefined);

      await sut.purchaseSubscription(paymentMethod, billingAddress, ["coupon-abc"]);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        "/account/billing/vnext/subscription",
        expect.objectContaining({ coupons: ["coupon-abc"] }),
        true,
        true,
      );
    });

    it("includes multiple coupons in request body when provided", async () => {
      const paymentMethod = { token: "tok_123", type: "card" } as any;
      const billingAddress = { country: "US", postalCode: "12345" };
      mockApiService.send.mockResolvedValue(undefined);

      await sut.purchaseSubscription(paymentMethod, billingAddress, ["coupon-abc", "coupon-xyz"]);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "POST",
        "/account/billing/vnext/subscription",
        expect.objectContaining({ coupons: ["coupon-abc", "coupon-xyz"] }),
        true,
        true,
      );
    });

    it("omits coupons from request body when not provided", async () => {
      const paymentMethod = { token: "tok_123", type: "card" } as any;
      const billingAddress = { country: "US", postalCode: "12345" };
      mockApiService.send.mockResolvedValue(undefined);

      await sut.purchaseSubscription(paymentMethod, billingAddress);

      const sentBody = mockApiService.send.mock.calls[0][2] as Record<string, unknown>;
      expect(sentBody).not.toHaveProperty("coupons");
    });

    it("omits coupons from request body when empty array is provided", async () => {
      const paymentMethod = { token: "tok_123", type: "card" } as any;
      const billingAddress = { country: "US", postalCode: "12345" };
      mockApiService.send.mockResolvedValue(undefined);

      await sut.purchaseSubscription(paymentMethod, billingAddress, []);

      const sentBody = mockApiService.send.mock.calls[0][2] as Record<string, unknown>;
      expect(sentBody).not.toHaveProperty("coupons");
    });
  });

  describe("getApplicableDiscounts", () => {
    it("calls the correct endpoint and maps the response array", async () => {
      const rawDiscount = {
        StripeCouponId: "coupon-abc",
        PercentOff: 20,
        AmountOff: null,
        Currency: null,
        Duration: "once",
        DurationInMonths: null,
        Name: "Test Coupon",
        StartDate: "2026-01-01T00:00:00Z",
        EndDate: "2026-12-31T00:00:00Z",
        TierEligibility: { "0": true, "1": false },
      };
      mockApiService.send.mockResolvedValue([rawDiscount]);

      const result = await sut.getApplicableDiscounts();

      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        "/account/billing/vnext/discounts",
        null,
        true,
        true,
      );
      expect(result).toHaveLength(1);
      expect(result[0].stripeCouponId).toBe("coupon-abc");
      expect(result[0].percentOff).toBe(20);
    });

    it("returns an empty array when the API returns an empty list", async () => {
      mockApiService.send.mockResolvedValue([]);

      const result = await sut.getApplicableDiscounts();

      expect(result).toEqual([]);
    });
  });
});
