import { EncString } from "@bitwarden/sdk-internal";

import { CardData } from "../../../vault/models/data/card.data";
import { Card } from "../../models/domain/card";

describe("Card", () => {
  let data: CardData;

  beforeEach(() => {
    data = {
      cardholderName: "encHolder",
      brand: "encBrand",
      number: "encNumber",
      expMonth: "encMonth",
      expYear: "encYear",
      code: "encCode",
    };
  });

  it("Convert from empty", () => {
    const data = new CardData();
    const card = new Card(data);

    expect(card).toEqual({
      cardholderName: undefined,
      brand: undefined,
      number: undefined,
      expMonth: undefined,
      expYear: undefined,
      code: undefined,
    });

    expect(data.cardholderName).toBeUndefined();
    expect(data.brand).toBeUndefined();
    expect(data.number).toBeUndefined();
    expect(data.expMonth).toBeUndefined();
    expect(data.expYear).toBeUndefined();
    expect(data.code).toBeUndefined();
  });

  it("Convert", () => {
    const card = new Card(data);

    expect(card).toEqual({
      cardholderName: "encHolder",
      brand: "encBrand",
      number: "encNumber",
      expMonth: "encMonth",
      expYear: "encYear",
      code: "encCode",
    });
  });

  it("toCardData", () => {
    const card = new Card(data);
    expect(card.toCardData()).toEqual(data);
  });

  describe("fromJSON", () => {
    it("initializes nested objects", () => {
      const actual = Card.fromJSON({
        cardholderName: "mockCardHolder" as EncString,
        brand: "mockBrand" as EncString,
        number: "mockNumber" as EncString,
        expMonth: "mockExpMonth" as EncString,
        expYear: "mockExpYear" as EncString,
        code: "mockCode" as EncString,
      });

      expect(actual).toEqual({
        cardholderName: "mockCardHolder",
        brand: "mockBrand",
        number: "mockNumber",
        expMonth: "mockExpMonth",
        expYear: "mockExpYear",
        code: "mockCode",
      });
      expect(actual).toBeInstanceOf(Card);
    });

    it("returns undefined if object is null", () => {
      expect(Card.fromJSON(null)).toBeUndefined();
    });
  });

  describe("toSdkCard", () => {
    it("should map to SDK Card", () => {
      const card = new Card(data);

      const sdkCard = card.toSdkCard();

      expect(sdkCard).toEqual({
        cardholderName: "encHolder",
        brand: "encBrand",
        number: "encNumber",
        expMonth: "encMonth",
        expYear: "encYear",
        code: "encCode",
      });
    });
  });
});
