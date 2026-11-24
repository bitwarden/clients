import { EncString } from "@bitwarden/sdk-internal";

import { Card as CardDomain } from "../../vault/models/domain/card";
import { CardView } from "../../vault/models/view/card.view";

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
    domain.cardholderName =
      req.cardholderName != null ? (req.cardholderName as EncString) : undefined;
    domain.brand = req.brand != null ? (req.brand as EncString) : undefined;
    domain.number = req.number != null ? (req.number as EncString) : undefined;
    domain.expMonth = req.expMonth != null ? (req.expMonth as EncString) : undefined;
    domain.expYear = req.expYear != null ? (req.expYear as EncString) : undefined;
    domain.code = req.code != null ? (req.code as EncString) : undefined;
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

    this.cardholderName = o.cardholderName ?? undefined;
    this.brand = o.brand ?? undefined;
    this.number = o.number ?? undefined;
    this.expMonth = o.expMonth ?? undefined;
    this.expYear = o.expYear ?? undefined;
    this.code = o.code ?? undefined;
  }
}
