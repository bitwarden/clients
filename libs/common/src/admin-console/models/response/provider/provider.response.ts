import { BaseResponse } from "../../../../models/response/base.response";
import { ProviderType } from "../../../enums";

export class ProviderResponse extends BaseResponse {
  id: string;
  name: string;
  businessName: string;
  billingEmail: string;
  creationDate: Date;
  type: ProviderType;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.name = this.getResponseProperty("Name");
    this.businessName = this.getResponseProperty("BusinessName");
    this.billingEmail = this.getResponseProperty("BillingEmail");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.type = this.getResponseProperty("Type");
  }
}
