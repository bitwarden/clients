// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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
    domain.cardholderName = req.cardholderName != null ? new EncString(req.cardholderName) : null;
    domain.brand = req.brand != null ? new EncString(req.brand) : null;
    domain.number = req.number != null ? new EncString(req.number) : null;
    domain.expMonth = req.expMonth != null ? new EncString(req.expMonth) : null;
    domain.expYear = req.expYear != null ? new EncString(req.expYear) : null;
    domain.code = req.code != null ? new EncString(req.code) : null;
    return domain;
  }

  cardholderName: string;
  brand: string;
  number: string;
  expMonth: string;
  expYear: string;
  code: string;

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
