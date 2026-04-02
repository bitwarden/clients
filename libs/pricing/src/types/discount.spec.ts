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

    it("should round result to 2 decimal places when percent produces fractional cents", () => {
      const discount: Discount = { type: DiscountTypes.PercentOff, value: 20 };
      // 20% of $47.88 = $9.576 → rounds to $9.58
      expect(getAmount(discount, 47.88)).toBe(9.58);
    });

    it("should round result when applied to a running subtotal with fractional cents", () => {
      const discount: Discount = { type: DiscountTypes.PercentOff, value: 5 };
      // 5% of $28.304 = $1.4152 → rounds to $1.42
      expect(getAmount(discount, 28.304)).toBe(1.42);
    });

    it("should round half-cent up", () => {
      const discount: Discount = { type: DiscountTypes.PercentOff, value: 50 };
      // 50% of $0.01 = $0.005 → rounds to $0.01
      expect(getAmount(discount, 0.01)).toBe(0.01);
    });

    it("should round down when fractional cent is less than half", () => {
      const discount: Discount = { type: DiscountTypes.PercentOff, value: 20 };
      // 20% of $47.82 = $9.564 → rounds down to $9.56
      expect(getAmount(discount, 47.82)).toBe(9.56);
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
