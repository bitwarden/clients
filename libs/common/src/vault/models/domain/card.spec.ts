import {
  makeSymmetricCryptoKey,
  mockContainerService,
  mockEnc,
  mockFromJson,
} from "../../../../spec";
import { EncryptedString, EncString } from "../../../key-management/crypto/models/enc-string";
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
      cardholderName: { encryptedString: "encHolder", encryptionType: 0 },
      brand: { encryptedString: "encBrand", encryptionType: 0 },
      number: { encryptedString: "encNumber", encryptionType: 0 },
      expMonth: { encryptedString: "encMonth", encryptionType: 0 },
      expYear: { encryptedString: "encYear", encryptionType: 0 },
      code: { encryptedString: "encCode", encryptionType: 0 },
    });
  });

  it("toCardData", () => {
    const card = new Card(data);
    expect(card.toCardData()).toEqual(data);
  });

  it("Decrypt", async () => {
    const card = new Card();
    card.cardholderName = mockEnc("cardHolder");
    card.brand = mockEnc("brand");
    card.number = mockEnc("number");
    card.expMonth = mockEnc("expMonth");
    card.expYear = mockEnc("expYear");
    card.code = mockEnc("code");

    const userKey = makeSymmetricCryptoKey(64);

    mockContainerService();
    const view = await card.decrypt(userKey);

    expect(view).toEqual({
      _brand: "brand",
      _number: "number",
      cardholderName: "cardHolder",
      code: "code",
      expMonth: "expMonth",
      expYear: "expYear",
    });
  });

  describe("fromJSON", () => {
    it("initializes nested objects", () => {
      jest.spyOn(EncString, "fromJSON").mockImplementation(mockFromJson);

      const actual = Card.fromJSON({
        cardholderName: "mockCardHolder" as EncryptedString,
        brand: "mockBrand" as EncryptedString,
        number: "mockNumber" as EncryptedString,
        expMonth: "mockExpMonth" as EncryptedString,
        expYear: "mockExpYear" as EncryptedString,
        code: "mockCode" as EncryptedString,
      });

      expect(actual).toEqual({
        cardholderName: "mockCardHolder_fromJSON",
        brand: "mockBrand_fromJSON",
        number: "mockNumber_fromJSON",
        expMonth: "mockExpMonth_fromJSON",
        expYear: "mockExpYear_fromJSON",
        code: "mockCode_fromJSON",
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
