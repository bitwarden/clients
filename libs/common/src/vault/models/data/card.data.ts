import { CardApi } from "../api/card.api";

export class CardData {
  cardholderName?: string;
  brand?: string;
  number?: string;
  expMonth?: string;
  expYear?: string;
  code?: string;

  constructor(data?: CardApi) {
    if (data == null) {
      return;
    }

    this.cardholderName = data.cardholderName;
    this.brand = data.brand;
    this.number = data.number;
    this.expMonth = data.expMonth;
    this.expYear = data.expYear;
    this.code = data.code;
  }
}
