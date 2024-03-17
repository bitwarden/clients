import { BaseResponse } from "../../../models/response/base.response";

export class OrganizationBillingStatusResponse extends BaseResponse {
  organizationId: string;
  organizationName: string;
  risksSubscriptionFailure: boolean;

  constructor(response: any) {
    super(response);

    this.organizationId = this.getResponseProperty("OrganizationId");
    this.organizationName = this.getResponseProperty("OrganizationName");
    this.risksSubscriptionFailure = this.getResponseProperty("RisksSubscriptionFailure");
  }
}
