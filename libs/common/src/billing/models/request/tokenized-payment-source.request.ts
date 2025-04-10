// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PaymentMethodType } from "../../enums";

export class TokenizedPaymentSourceRequest {
  type: PaymentMethodType;
  token: string;
}
