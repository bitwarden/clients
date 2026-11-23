import { CardView } from "./card.view";

describe("CardView", () => {
  describe("toSdkCardView", () => {
    it("should convert populated fields", () => {
      const cardView = new CardView();
      cardView.cardholderName = "John Doe";
      cardView.brand = "Visa";
      cardView.number = "4111111111111111";
      cardView.expMonth = "12";
      cardView.expYear = "2030";
      cardView.code = "123";

      const result = cardView.toSdkCardView();

      expect(result).toEqual({
        cardholderName: "John Doe",
        brand: "Visa",
        number: "4111111111111111",
        expMonth: "12",
        expYear: "2030",
        code: "123",
      });
    });

    it("should convert empty strings to undefined", () => {
      const cardView = new CardView();
      cardView.cardholderName = "";
      cardView.brand = "";
      cardView.number = "";
      cardView.expMonth = "";
      cardView.expYear = "";
      cardView.code = "";

      const result = cardView.toSdkCardView();

      expect(result).toEqual({
        cardholderName: undefined,
        brand: undefined,
        number: undefined,
        expMonth: undefined,
        expYear: undefined,
        code: undefined,
      });
    });

    it("should only convert the empty fields to undefined", () => {
      const cardView = new CardView();
      cardView.cardholderName = "John Doe";
      cardView.number = "";
      cardView.code = "";

      const result = cardView.toSdkCardView();

      expect(result.cardholderName).toBe("John Doe");
      expect(result.number).toBeUndefined();
      expect(result.code).toBeUndefined();
    });
  });

  describe("getCardBrandByPatterns", () => {
    it.each([
      "5085000000000000",
      "5089990000000000",
      "6069850000000000",
      "6079840000000000",
      "6080010000000000",
      "6085000000000000",
      "6521500000000000",
      "6521 5000 0000 0000",
      "6521-5700-0000-0000",
      "6531490000000000",
      "8172000000000000",
      "8201990000000000",
    ])("should detect RuPay for %s", (cardNumber) => {
      expect(CardView.getCardBrandByPatterns(cardNumber)).toBe("RuPay");
    });

    it.each(["6011000000000004", "6500000000000000", "6521490000000000", "6531500000000000"])(
      "should keep Discover detection for non-RuPay prefix %s",
      (cardNumber) => {
        expect(CardView.getCardBrandByPatterns(cardNumber)).toBe("Discover");
      },
    );

    it.each([
      "5084990000000000",
      "5090000000000000",
      "6069840000000000",
      "6079850000000000",
      "6080000000000000",
      "6085010000000000",
      "8171990000000000",
      "8202000000000000",
    ])("should not match RuPay for out-of-range prefix %s", (cardNumber) => {
      expect(CardView.getCardBrandByPatterns(cardNumber)).toBeUndefined();
    });
  });
});
