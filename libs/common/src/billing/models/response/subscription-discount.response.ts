import { DiscountTierType } from "@bitwarden/common/billing/enums";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export interface SubscriptionDiscount {
  stripeCouponId: string;
  percentOff?: number;
  amountOff?: number; // in cents
  currency?: string;
  duration: "once" | "repeating" | "forever";
  durationInMonths?: number;
  name?: string;
  startDate: string;
  endDate: string;
  tierEligibility: Record<DiscountTierType, boolean>;
}

export class SubscriptionDiscountResponse extends BaseResponse implements SubscriptionDiscount {
  stripeCouponId: string;
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  duration: "once" | "repeating" | "forever";
  durationInMonths?: number;
  name?: string;
  startDate: string;
  endDate: string;
  tierEligibility: Record<DiscountTierType, boolean>;

  constructor(response: any) {
    super(response);
    this.stripeCouponId = this.getResponseProperty("StripeCouponId");
    this.percentOff = this.getResponseProperty("PercentOff") ?? undefined;
    this.amountOff = this.getResponseProperty("AmountOff") ?? undefined;
    this.currency = this.getResponseProperty("Currency") ?? undefined;
    this.duration = this.getResponseProperty("Duration");
    this.durationInMonths = this.getResponseProperty("DurationInMonths") ?? undefined;
    this.name = this.getResponseProperty("Name") ?? undefined;
    this.startDate = this.getResponseProperty("StartDate");
    this.endDate = this.getResponseProperty("EndDate");
    this.tierEligibility = this.getResponseProperty("TierEligibility");
  }
}
