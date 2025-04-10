// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PaymentMethodType } from "../../enums";

import { ExpandedTaxInfoUpdateRequest } from "./expanded-tax-info-update.request";

export class PaymentRequest extends ExpandedTaxInfoUpdateRequest {
  paymentMethodType: PaymentMethodType;
  paymentToken: string;
}
