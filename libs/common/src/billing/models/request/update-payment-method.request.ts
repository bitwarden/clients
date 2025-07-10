// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ExpandedTaxInfoUpdateRequest } from "./expanded-tax-info-update.request";
import { TokenizedPaymentSourceRequest } from "./tokenized-payment-source.request";

export class UpdatePaymentMethodRequest {
  paymentSource: TokenizedPaymentSourceRequest;
  taxInformation: ExpandedTaxInfoUpdateRequest;
}
