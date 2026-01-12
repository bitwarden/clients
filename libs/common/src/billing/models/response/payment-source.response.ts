import { BaseResponse } from "../../../models/response/base.response";
import { PaymentMethodType } from "../../enums";

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
