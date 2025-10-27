import { Jsonify } from "type-fest";

import { Card as SdkCard } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { conditionalEncString, encStringFrom } from "../../utils/domain-utils";
import { CardData } from "../data/card.data";
import { CardView } from "../view/card.view";

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

    this.cardholderName = conditionalEncString(obj.cardholderName);
    this.brand = conditionalEncString(obj.brand);
    this.number = conditionalEncString(obj.number);
    this.expMonth = conditionalEncString(obj.expMonth);
    this.expYear = conditionalEncString(obj.expYear);
    this.code = conditionalEncString(obj.code);
  }

  async decrypt(
    userId: UserId,
    orgId: string | undefined,
    context = "No Cipher Context",
    encKey?: SymmetricCryptoKey,
  ): Promise<CardView> {
    return this.decryptObj<Card, CardView>(
      this,
      new CardView(),
      ["cardholderName", "brand", "number", "expMonth", "expYear", "code"],
      userId,
      orgId ?? null,
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

  static fromJSON(obj: Partial<Jsonify<Card>> | undefined): Card | undefined {
    if (obj == null) {
      return undefined;
    }

    const card = new Card();
    card.cardholderName = encStringFrom(obj.cardholderName);
    card.brand = encStringFrom(obj.brand);
    card.number = encStringFrom(obj.number);
    card.expMonth = encStringFrom(obj.expMonth);
    card.expYear = encStringFrom(obj.expYear);
    card.code = encStringFrom(obj.code);

    return card;
  }

  /**
   *  Maps Card to SDK format.
   *
   * @returns {SdkCard} The SDK card object.
   */
  toSdkCard(): SdkCard {
    return {
      cardholderName: this.cardholderName?.toSdk(),
      brand: this.brand?.toSdk(),
      number: this.number?.toSdk(),
      expMonth: this.expMonth?.toSdk(),
      expYear: this.expYear?.toSdk(),
      code: this.code?.toSdk(),
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
    card.cardholderName = encStringFrom(obj.cardholderName);
    card.brand = encStringFrom(obj.brand);
    card.number = encStringFrom(obj.number);
    card.expMonth = encStringFrom(obj.expMonth);
    card.expYear = encStringFrom(obj.expYear);
    card.code = encStringFrom(obj.code);

    return card;
  }
}
