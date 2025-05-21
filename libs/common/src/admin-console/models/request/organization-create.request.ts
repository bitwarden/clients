// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PaymentMethodType } from "../../../billing/enums";
import { OrganizationNoPaymentMethodCreateRequest } from "../../../billing/models/request/organization-no-payment-method-create-request";

export class OrganizationCreateRequest extends OrganizationNoPaymentMethodCreateRequest {
  paymentMethodType: PaymentMethodType;
  paymentToken: string;
  skipTrial?: boolean;
}
