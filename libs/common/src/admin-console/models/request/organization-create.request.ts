import { PaymentMethodType } from "../../../billing/enums";
import { OrganizationNoPaymentMethodCreateRequest } from "../../../billing/models/request/organization-no-payment-method-create-request";

export class OrganizationCreateRequest extends OrganizationNoPaymentMethodCreateRequest {
  paymentMethodType: PaymentMethodType;
  paymentToken: string;
}
