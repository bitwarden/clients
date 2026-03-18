import { Discount, DiscountTypes, getAmount } from "./discount";

describe("getAmount", () => {
  describe("PercentOff", () => {
    it("should calculate percentage from whole-number value", () => {
      const discount: Discount = { type: DiscountTypes.PercentOff, value: 25 };
      // 25% of $200 = $50
      expect(getAmount(discount, 200)).toBe(50);
    });

    it("should calculate percentage from decimal value (< 1)", () => {
      const discount: Discount = { type: DiscountTypes.PercentOff, value: 0.25 };
      // 0.25 treated as 25% of $200 = $50
      expect(getAmount(discount, 200)).toBe(50);
    });

    it("should treat value of exactly 1 as 1%", () => {
      const discount: Discount = { type: DiscountTypes.PercentOff, value: 1 };
      // 1 / 100 = 0.01, 1% of $200 = $2
      expect(getAmount(discount, 200)).toBe(2);
    });

    it("should return 0 when base amount is 0", () => {
      const discount: Discount = { type: DiscountTypes.PercentOff, value: 25 };
      expect(getAmount(discount, 0)).toBe(0);
    });

    it("should handle value of 0", () => {
      const discount: Discount = { type: DiscountTypes.PercentOff, value: 0 };
      expect(getAmount(discount, 200)).toBe(0);
    });

    it("should handle 100% discount", () => {
      const discount: Discount = { type: DiscountTypes.PercentOff, value: 100 };
      expect(getAmount(discount, 200)).toBe(200);
    });
  });

  describe("AmountOff", () => {
    it("should return the discount value directly", () => {
      const discount: Discount = { type: DiscountTypes.AmountOff, value: 15 };
      expect(getAmount(discount, 200)).toBe(15);
    });

    it("should return the discount value regardless of base amount", () => {
      const discount: Discount = { type: DiscountTypes.AmountOff, value: 50 };
      // AmountOff ignores baseAmount — returns raw value even if it exceeds base
      expect(getAmount(discount, 30)).toBe(50);
    });

    it("should return 0 for zero-value discount", () => {
      const discount: Discount = { type: DiscountTypes.AmountOff, value: 0 };
      expect(getAmount(discount, 200)).toBe(0);
    });
  });
});
