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
    if (!seat || typeof seat !== "object") {
      throw new Error("PremiumPlanResponse: Missing or invalid 'Seat' property");
    }
    this.seat = new PurchasableResponse(seat);

    const storage = this.getResponseProperty("Storage");
    if (!storage || typeof storage !== "object") {
      throw new Error("PremiumPlanResponse: Missing or invalid 'Storage' property");
    }
    this.storage = new PurchasableResponse(storage);
  }
}

class PurchasableResponse extends BaseResponse {
  stripePriceId: string;
  price: number;

  constructor(response: any) {
    super(response);

    this.stripePriceId = this.getResponseProperty("StripePriceId");
    if (!this.stripePriceId || typeof this.stripePriceId !== "string") {
      throw new Error("PurchasableResponse: Missing or invalid 'StripePriceId' property");
    }

    this.price = this.getResponseProperty("Price");
    if (typeof this.price !== "number" || isNaN(this.price)) {
      throw new Error("PurchasableResponse: Missing or invalid 'Price' property");
    }
  }
}
