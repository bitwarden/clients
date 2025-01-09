import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class SubscriptionSuspensionResponse extends BaseResponse {
  suspensionDate: string;
  unpaidPeriodEndDate: string;
  gracePeriod: number;

  constructor(response: any) {
    super(response);

    this.suspensionDate = this.getResponseProperty("suspensionDate");
    this.unpaidPeriodEndDate = this.getResponseProperty("unpaidPeriodEndDate");
    this.gracePeriod = this.getResponseProperty("gracePeriod");
  }
}
