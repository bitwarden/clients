// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import Domain from "../../../platform/models/domain/domain-base";
import { EncString } from "../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { CardData } from "../data/card.data";
import { CardView } from "../view/card.view";

export class Card extends Domain {
  cardholderName: EncString;
  brand: EncString;
  number: EncString;
  expMonth: EncString;
  expYear: EncString;
  code: EncString;

  constructor(obj?: CardData) {
    super();
    if (obj == null) {
      return;
    }

    this.buildDomainModel(
      this,
      obj,
      {
        cardholderName: null,
        brand: null,
        number: null,
        expMonth: null,
        expYear: null,
        code: null,
      },
      [],
    );
  }

  async decrypt(
    orgId: string,
    context = "No Cipher Context",
    encKey?: SymmetricCryptoKey,
  ): Promise<CardView> {
    return this.decryptObj(
      new CardView(),
      {
        cardholderName: null,
        brand: null,
        number: null,
        expMonth: null,
        expYear: null,
        code: null,
      },
      orgId,
      encKey,
      "DomainType: Card; " + context,
    );
  }

  toCardData(): CardData {
    const c = new CardData();
    this.buildDataModel(this, c, {
      cardholderName: null,
      brand: null,
      number: null,
      expMonth: null,
      expYear: null,
      code: null,
    });
    return c;
  }

  static fromJSON(obj: Partial<Jsonify<Card>>): Card {
    if (obj == null) {
      return null;
    }

    const cardholderName = EncString.fromJSON(obj.cardholderName);
    const brand = EncString.fromJSON(obj.brand);
    const number = EncString.fromJSON(obj.number);
    const expMonth = EncString.fromJSON(obj.expMonth);
    const expYear = EncString.fromJSON(obj.expYear);
    const code = EncString.fromJSON(obj.code);
    return Object.assign(new Card(), obj, {
      cardholderName,
      brand,
      number,
      expMonth,
      expYear,
      code,
    });
  }
}
