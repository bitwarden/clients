import { EncString } from "../../key-management/crypto/models/enc-string";
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
    domain.cardholderName = req.cardholderName ? new EncString(req.cardholderName) : undefined;
    domain.brand = req.brand ? new EncString(req.brand) : undefined;
    domain.number = req.number ? new EncString(req.number) : undefined;
    domain.expMonth = req.expMonth ? new EncString(req.expMonth) : undefined;
    domain.expYear = req.expYear ? new EncString(req.expYear) : undefined;
    domain.code = req.code ? new EncString(req.code) : undefined;
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
