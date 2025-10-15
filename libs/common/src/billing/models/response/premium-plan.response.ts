import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class PremiumPlanResponse extends BaseResponse {
  seat: {
    stripePriceId: string;
    price: number;
  };
  storage: {
    stripePriceId: string;
    price: number;
  };

  constructor(response: any) {
    super(response);

    const seat = this.getResponseProperty("Seat");
    this.seat = new PurchasableResponse(seat);

    const storage = this.getResponseProperty("Storage");
    this.storage = new PurchasableResponse(storage);
  }
}

class PurchasableResponse extends BaseResponse {
  stripePriceId: string;
  price: number;

  constructor(response: any) {
    super(response);

    this.stripePriceId = this.getResponseProperty("StripePriceId");
    this.price = this.getResponseProperty("Price");
  }
}
