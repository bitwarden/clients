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
});
