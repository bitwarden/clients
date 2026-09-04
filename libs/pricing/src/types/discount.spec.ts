import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { CartDiscount, Discount, DiscountTypes, getAmount, getLabel } from "./discount";

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

describe("getLabel", () => {
  let i18nService: I18nService;

  beforeEach(() => {
    i18nService = mock<I18nService>();
    (i18nService.t as jest.Mock).mockImplementation((key: string) => key);
  });

  describe("without a server-supplied label", () => {
    it("should derive a label from a whole-number percent-off discount", () => {
      const discount: Discount = { type: DiscountTypes.PercentOff, value: 25 };
      expect(getLabel(i18nService, discount)).toBe("25% discount");
    });

    it("should derive a label from a decimal percent-off discount", () => {
      const discount: Discount = { type: DiscountTypes.PercentOff, value: 0.25 };
      expect(getLabel(i18nService, discount)).toBe("25% discount");
    });

    it("should derive a label from an amount-off discount", () => {
      const discount: Discount = { type: DiscountTypes.AmountOff, value: 15 };
      expect(getLabel(i18nService, discount)).toBe("$15.00 discount");
    });
  });

  describe("with a server-supplied label", () => {
    it("should prefer the label over the derived percent-off label", () => {
      const discount: CartDiscount = {
        type: DiscountTypes.PercentOff,
        value: 25,
        label: "Launch promotion",
      };
      expect(getLabel(i18nService, discount)).toBe("Launch promotion");
    });

    it("should prefer the label over the derived amount-off label", () => {
      const discount: CartDiscount = {
        type: DiscountTypes.AmountOff,
        value: 15,
        label: "Loyalty coupon",
      };
      expect(getLabel(i18nService, discount)).toBe("Loyalty coupon");
    });

    it("should not consult the i18n service when a label is supplied", () => {
      const discount: CartDiscount = {
        type: DiscountTypes.PercentOff,
        value: 25,
        label: "Launch promotion",
      };

      getLabel(i18nService, discount);

      expect(i18nService.t).not.toHaveBeenCalled();
    });

    it("should fall back to the derived label when the label is an empty string", () => {
      const discount: CartDiscount = { type: DiscountTypes.PercentOff, value: 25, label: "" };
      expect(getLabel(i18nService, discount)).toBe("25% discount");
    });
  });
});
