import { CardView } from "./card.view";

describe("CardView", () => {
  describe("toSdkCardView", () => {
    it("converts populated fields", () => {
      const cardView = new CardView();
      cardView.cardholderName = "Jane Doe";
      cardView.brand = "Visa";
      cardView.number = "4242424242424242";
      cardView.expMonth = "4";
      cardView.expYear = "2030";
      cardView.code = "123";

      const result = cardView.toSdkCardView();

      expect(result).toEqual({
        cardholderName: "Jane Doe",
        brand: "Visa",
        number: "4242424242424242",
        expMonth: "4",
        expYear: "2030",
        code: "123",
      });
    });

    it("converts empty strings to undefined", () => {
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
  });
});
