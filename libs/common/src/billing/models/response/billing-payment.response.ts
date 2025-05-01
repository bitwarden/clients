// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../models/response/base.response";

import { BillingSourceResponse } from "./billing.response";

export class BillingPaymentResponse extends BaseResponse {
  balance: number;
  paymentSource: BillingSourceResponse;

  constructor(response: any) {
    super(response);
    this.balance = this.getResponseProperty("Balance");
    const paymentSource = this.getResponseProperty("PaymentSource");
    this.paymentSource = paymentSource == null ? null : new BillingSourceResponse(paymentSource);
  }
}
