import { conditionalEncString } from "@bitwarden/common/vault/utils/domain-utils";

import { Card as CardDomain } from "../../vault/models/domain/card";
import { CardView } from "../../vault/models/view/card.view";

import { safeGetString } from "./utils";

export class CardExport {
  static template(): CardExport {
    const req = new CardExport();
    req.cardholderName = "John Doe";
    req.brand = "visa";
    req.number = "4242424242424242";
    req.expMonth = "04";
    req.expYear = "2023";
    req.code = "123";
    return req;
  }

  static toView(req: CardExport, view = new CardView()) {
    view.cardholderName = req.cardholderName;
    view.brand = req.brand;
    view.number = req.number;
    view.expMonth = req.expMonth;
    view.expYear = req.expYear;
    view.code = req.code;
    return view;
  }

  static toDomain(req: CardExport, domain = new CardDomain()) {
    domain.cardholderName = conditionalEncString(req.cardholderName);
    domain.brand = conditionalEncString(req.brand);
    domain.number = conditionalEncString(req.number);
    domain.expMonth = conditionalEncString(req.expMonth);
    domain.expYear = conditionalEncString(req.expYear);
    domain.code = conditionalEncString(req.code);
    return domain;
  }

  cardholderName?: string;
  brand?: string;
  number?: string;
  expMonth?: string;
  expYear?: string;
  code?: string;

  constructor(o?: CardView | CardDomain) {
    if (o == null) {
      return;
    }

    this.cardholderName = safeGetString(o.cardholderName);
    this.brand = safeGetString(o.brand);
    this.number = safeGetString(o.number);
    this.expMonth = safeGetString(o.expMonth);
    this.expYear = safeGetString(o.expYear);
    this.code = safeGetString(o.code);
  }
}
