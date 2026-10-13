import { BaseResponse } from "../../../models/response/base.response";

import { PlanResponse } from "./plan.response";
import { BillingSubscriptionItemResponse } from "./subscription.response";

export class PendingAnnualUpgradeResponse extends BaseResponse {
  plan: PlanResponse;
  /**
   * Undefined when the caller may not see sensitive billing data. The server nulls this for
   * view-only admins; plan and effectiveDate are always sent.
   */
  lineItems: BillingSubscriptionItemResponse[] | undefined;
  effectiveDate: Date;

  constructor(response: any) {
    super(response);
    this.plan = new PlanResponse(this.getResponseProperty("Plan"));
    const lineItems = this.getResponseProperty("LineItems");
    if (lineItems != null) {
      this.lineItems = lineItems.map((i: any) => new BillingSubscriptionItemResponse(i));
    }
    this.effectiveDate = new Date(this.getResponseProperty("EffectiveDate"));
  }
}
