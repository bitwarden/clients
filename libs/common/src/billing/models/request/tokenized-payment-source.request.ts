// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PaymentMethodType } from "@bitwarden/common/billing/enums";

export class TokenizedPaymentSourceRequest {
  type: PaymentMethodType;
  token: string;
}
