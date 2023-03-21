import { Guid } from "../../../types/guid";
import { BaseResponse } from "../base.response";

export class ProviderResponse extends BaseResponse {
  id: Guid;
  name: string;
  businessName: string;
  billingEmail: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.name = this.getResponseProperty("Name");
    this.businessName = this.getResponseProperty("BusinessName");
    this.billingEmail = this.getResponseProperty("BillingEmail");
  }
}
