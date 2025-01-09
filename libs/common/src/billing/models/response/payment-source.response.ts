import { PaymentMethodType } from "@bitwarden/common/billing/enums";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class PaymentSourceResponse extends BaseResponse {
  type: PaymentMethodType;
  description: string;
  needsVerification: boolean;

  constructor(response: any) {
    super(response);
    this.type = this.getResponseProperty("Type");
    this.description = this.getResponseProperty("Description");
    this.needsVerification = this.getResponseProperty("NeedsVerification");
  }
}
