import { Jsonify } from "type-fest";

import { Card as SdkCard, EncString } from "@bitwarden/sdk-internal";

import Domain from "../../../platform/models/domain/domain-base";
import { CardData } from "../data/card.data";

export class Card extends Domain {
  cardholderName?: EncString;
  brand?: EncString;
  number?: EncString;
  expMonth?: EncString;
  expYear?: EncString;
  code?: EncString;

  constructor(obj?: CardData) {
    super();
    if (obj == null) {
      return;
    }

    this.cardholderName = (obj.cardholderName ?? undefined) as EncString;
    this.brand = (obj.brand ?? undefined) as EncString;
    this.number = (obj.number ?? undefined) as EncString;
    this.expMonth = (obj.expMonth ?? undefined) as EncString;
    this.expYear = (obj.expYear ?? undefined) as EncString;
    this.code = (obj.code ?? undefined) as EncString;
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

  static fromJSON(obj: Partial<Jsonify<Card>> | undefined): Card | undefined {
    if (obj == null) {
      return undefined;
    }

    const card = new Card();
    card.cardholderName = obj.cardholderName ?? undefined;
    card.brand = obj.brand ?? undefined;
    card.number = obj.number ?? undefined;
    card.expMonth = obj.expMonth ?? undefined;
    card.expYear = obj.expYear ?? undefined;
    card.code = obj.code ?? undefined;

    return card;
  }

  /**
   *  Maps Card to SDK format.
   *
   * @returns {SdkCard} The SDK card object.
   */
  toSdkCard(): SdkCard {
    return {
      cardholderName: this.cardholderName ?? undefined,
      brand: this.brand ?? undefined,
      number: this.number ?? undefined,
      expMonth: this.expMonth ?? undefined,
      expYear: this.expYear ?? undefined,
      code: this.code ?? undefined,
    };
  }

  /**
   * Maps an SDK Card object to a Card
   * @param obj - The SDK Card object
   */
  static fromSdkCard(obj?: SdkCard): Card | undefined {
    if (!obj) {
      return undefined;
    }

    const card = new Card();
    card.cardholderName = obj.cardholderName ?? undefined;
    card.brand = obj.brand ?? undefined;
    card.number = obj.number ?? undefined;
    card.expMonth = obj.expMonth ?? undefined;
    card.expYear = obj.expYear ?? undefined;
    card.code = obj.code ?? undefined;

    return card;
  }
}
