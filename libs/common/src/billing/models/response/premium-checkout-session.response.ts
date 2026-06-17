import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class PremiumCheckoutSessionResponse extends BaseResponse {
  checkoutSessionUrl: string;

  constructor(response: any) {
    super(response);
    this.checkoutSessionUrl = this.getResponseProperty("CheckoutSessionUrl");
  }
}
