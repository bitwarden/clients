jest.mock("@bitwarden/pricing", () => ({
  DiscountTypes: {
    AmountOff: "amount-off",
    PercentOff: "percent-off",
  },
}));

import { CartResponse } from "./cart.response";

describe("CartResponse", () => {
  const baseResponse = {
    PasswordManager: {
      Seats: {
        TranslationKey: "seats",
        Quantity: 1,
        Cost: 1000,
      },
    },
    Cadence: "annually",
    EstimatedTax: 0,
  };

  const discountA = { Type: "percent-off", Value: 10 };
  const discountB = { Type: "amount-off", Value: 500 };

  it("constructor_discountsArrayProvided_populatesAllDiscounts", () => {
    const sut = new CartResponse({ ...baseResponse, Discounts: [discountA, discountB] });

    expect(sut.discounts).toBeDefined();
    expect(sut.discounts!.length).toBe(2);
    expect(sut.discounts![0].type).toBe("percent-off");
    expect(sut.discounts![0].value).toBe(10);
    expect(sut.discounts![1].type).toBe("amount-off");
    expect(sut.discounts![1].value).toBe(500);
  });

  it("constructor_discountsAbsent_leavesDiscountsUndefined", () => {
    const sut = new CartResponse({ ...baseResponse });

    expect(sut.discounts).toBeUndefined();
  });

  it("constructor_discountsEmptyArray_leavesDiscountsUndefined", () => {
    const sut = new CartResponse({ ...baseResponse, Discounts: [] });

    expect(sut.discounts).toBeUndefined();
  });
});
