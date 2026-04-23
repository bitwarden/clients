import {
  Discount,
  DiscountTypes,
  SM_STANDALONE_DISCOUNT_ID,
  applyDiscountsSequentially,
  getAmount,
  isSmStandaloneTrial,
  toDisplayableDiscounts,
} from "./discount";

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

describe("toDisplayableDiscounts", () => {
  it("should return empty array for empty input", () => {
    expect(toDisplayableDiscounts([])).toEqual([]);
  });

  it("should filter out inactive discounts", () => {
    const discounts = [{ id: "d1", active: false, percentOff: 10, amountOff: 0 }];
    expect(toDisplayableDiscounts(discounts)).toEqual([]);
  });

  it("should filter out discounts with zero values", () => {
    const discounts = [{ id: "d1", active: true, percentOff: 0, amountOff: 0 }];
    expect(toDisplayableDiscounts(discounts)).toEqual([]);
  });

  it("should map percentOff discounts to PercentOff type", () => {
    const discounts = [{ id: "d1", active: true, percentOff: 25, amountOff: 0 }];
    expect(toDisplayableDiscounts(discounts)).toEqual([
      { type: DiscountTypes.PercentOff, value: 25 },
    ]);
  });

  it("should map amountOff discounts to AmountOff type", () => {
    const discounts = [{ id: "d1", active: true, percentOff: 0, amountOff: 5 }];
    expect(toDisplayableDiscounts(discounts)).toEqual([
      { type: DiscountTypes.AmountOff, value: 5 },
    ]);
  });

  it("should prefer amountOff when both are set", () => {
    const discounts = [{ id: "d1", active: true, percentOff: 10, amountOff: 5 }];
    expect(toDisplayableDiscounts(discounts)).toEqual([
      { type: DiscountTypes.AmountOff, value: 5 },
    ]);
  });

  it("should exclude discounts matching excludeIds", () => {
    const discounts = [
      { id: "sm-standalone", active: true, percentOff: 100, amountOff: 0 },
      { id: "org-discount", active: true, percentOff: 10, amountOff: 0 },
    ];
    const result = toDisplayableDiscounts(discounts, new Set(["sm-standalone"]));
    expect(result).toEqual([{ type: DiscountTypes.PercentOff, value: 10 }]);
  });

  it("should not exclude any when excludeIds is omitted", () => {
    const discounts = [
      { id: "sm-standalone", active: true, percentOff: 100, amountOff: 0 },
      { id: "org-discount", active: true, percentOff: 10, amountOff: 0 },
    ];
    expect(toDisplayableDiscounts(discounts)).toEqual([
      { type: DiscountTypes.PercentOff, value: 100 },
      { type: DiscountTypes.PercentOff, value: 10 },
    ]);
  });
});

describe("SM_STANDALONE_DISCOUNT_ID", () => {
  it("should equal 'sm-standalone'", () => {
    expect(SM_STANDALONE_DISCOUNT_ID).toBe("sm-standalone");
  });
});

describe("isSmStandaloneTrial", () => {
  it("should return false for empty discounts", () => {
    expect(isSmStandaloneTrial([], [{ productId: "prod_1" }])).toBe(false);
  });

  it("should return false when no sm-standalone discount exists", () => {
    const discounts = [{ id: "other", active: true, appliesTo: ["prod_1"] }];
    expect(isSmStandaloneTrial(discounts, [{ productId: "prod_1" }])).toBe(false);
  });

  it("should return false when sm-standalone discount is inactive", () => {
    const discounts = [{ id: "sm-standalone", active: false, appliesTo: ["prod_1"] }];
    expect(isSmStandaloneTrial(discounts, [{ productId: "prod_1" }])).toBe(false);
  });

  it("should return false when sm-standalone does not apply to any subscription item", () => {
    const discounts = [{ id: "sm-standalone", active: true, appliesTo: ["prod_2"] }];
    expect(isSmStandaloneTrial(discounts, [{ productId: "prod_1" }])).toBe(false);
  });

  it("should return true when active sm-standalone applies to a subscription item", () => {
    const discounts = [{ id: "sm-standalone", active: true, appliesTo: ["prod_1"] }];
    expect(isSmStandaloneTrial(discounts, [{ productId: "prod_1" }])).toBe(true);
  });

  it("should return true when sm-standalone applies to one of multiple items", () => {
    const discounts = [{ id: "sm-standalone", active: true, appliesTo: ["prod_2"] }];
    const items = [{ productId: "prod_1" }, { productId: "prod_2" }];
    expect(isSmStandaloneTrial(discounts, items)).toBe(true);
  });

  it("should return false when subscription items are undefined", () => {
    const discounts = [{ id: "sm-standalone", active: true, appliesTo: ["prod_1"] }];
    expect(isSmStandaloneTrial(discounts, undefined)).toBe(false);
  });

  it("should return false when discounts array is null", () => {
    expect(isSmStandaloneTrial(null, [{ productId: "prod_1" }])).toBe(false);
  });
});

describe("applyDiscountsSequentially", () => {
  it("should return the original price when there are no discounts", () => {
    expect(applyDiscountsSequentially(100, [])).toBe(100);
  });

  it("should skip inactive discounts", () => {
    const discounts = [{ active: false, percentOff: 50 }];
    expect(applyDiscountsSequentially(100, discounts)).toBe(100);
  });

  it("should apply a single percent-off discount", () => {
    const discounts = [{ active: true, percentOff: 10 }];
    expect(applyDiscountsSequentially(100, discounts)).toBe(90);
  });

  it("should apply a single amount-off discount", () => {
    const discounts = [{ active: true, amountOff: 15 }];
    expect(applyDiscountsSequentially(100, discounts)).toBe(85);
  });

  it("should compound multiple percent-off discounts sequentially", () => {
    const discounts = [
      { active: true, percentOff: 10 },
      { active: true, percentOff: 20 },
    ];
    // 100 -> 90 -> 72
    expect(applyDiscountsSequentially(100, discounts)).toBe(72);
  });

  it("should apply mixed percent-off and amount-off discounts sequentially", () => {
    const discounts = [
      { active: true, percentOff: 10 },
      { active: true, amountOff: 5 },
    ];
    // 100 -> 90 -> 85
    expect(applyDiscountsSequentially(100, discounts)).toBe(85);
  });

  it("should floor the result at zero", () => {
    const discounts = [{ active: true, amountOff: 200 }];
    expect(applyDiscountsSequentially(100, discounts)).toBe(0);
  });

  it("should skip product-scoped discounts when no productId is provided", () => {
    const discounts = [{ active: true, percentOff: 50, appliesTo: ["prod_1"] }];
    expect(applyDiscountsSequentially(100, discounts)).toBe(100);
  });

  it("should skip product-scoped discounts when productId does not match", () => {
    const discounts = [{ active: true, percentOff: 50, appliesTo: ["prod_1"] }];
    expect(applyDiscountsSequentially(100, discounts, "prod_2")).toBe(100);
  });

  it("should apply product-scoped discounts when productId matches", () => {
    const discounts = [{ active: true, percentOff: 50, appliesTo: ["prod_1"] }];
    expect(applyDiscountsSequentially(100, discounts, "prod_1")).toBe(50);
  });

  it("should apply non-scoped discounts regardless of productId", () => {
    const discounts = [{ active: true, percentOff: 10, appliesTo: [] as string[] }];
    expect(applyDiscountsSequentially(100, discounts, "prod_1")).toBe(90);
  });
});
