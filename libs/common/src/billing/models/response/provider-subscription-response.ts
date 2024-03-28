import { BaseResponse } from "../../../models/response/base.response";

import { ProviderPlansResponse } from "./provider-plans.response";

export class ProviderSubscriptionResponse extends BaseResponse {
  status: string;
  currentPeriodEndDate: Date;
  discountPercentage?: number | null;
  providerPlans: ProviderPlansResponse[];

  constructor(response: any) {
    super(response);
    this.status = this.getResponseProperty("status");
    this.currentPeriodEndDate = new Date(this.getResponseProperty("currentPeriodEndDate"));
    this.discountPercentage = this.getResponseProperty("discountPercentage");
    this.providerPlans = (this.getResponseProperty("providerPlans") || []).map(
      (plan: any) => new ProviderPlansResponse(plan),
    );
  }
}
