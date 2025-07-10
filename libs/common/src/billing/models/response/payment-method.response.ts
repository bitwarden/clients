import { BaseResponse } from "../../../models/response/base.response";

import { PaymentSourceResponse } from "./payment-source.response";
import { TaxInfoResponse } from "./tax-info.response";

export class PaymentMethodResponse extends BaseResponse {
  accountCredit: number;
  paymentSource?: PaymentSourceResponse;
  subscriptionStatus?: string;
  taxInformation?: TaxInfoResponse;

  constructor(response: any) {
    super(response);
    this.accountCredit = this.getResponseProperty("AccountCredit");

    const paymentSource = this.getResponseProperty("PaymentSource");
    if (paymentSource) {
      this.paymentSource = new PaymentSourceResponse(paymentSource);
    }

    this.subscriptionStatus = this.getResponseProperty("SubscriptionStatus");

    const taxInformation = this.getResponseProperty("TaxInformation");
    if (taxInformation) {
      this.taxInformation = new TaxInfoResponse(taxInformation);
    }
  }
}
