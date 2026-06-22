import { PaymentSourceResponse } from "@bitwarden/common/billing/models/response/payment-source.response";

import { ProviderType } from "../../../admin-console/enums";
import { BaseResponse } from "../../../models/response/base.response";
import { PlanType, ProductTierType } from "../../enums";

import { SubscriptionSuspensionResponse } from "./subscription-suspension.response";
import { TaxInfoResponse } from "./tax-info.response";

export class ProviderSubscriptionResponse extends BaseResponse {
  status: string;
  currentPeriodEndDate: string;
  discountPercentage?: number | null;
  collectionMethod: string;
  plans: ProviderPlanResponse[] = [];
  accountCredit: number;
  taxInformation?: TaxInfoResponse;
  cancelAt?: string;
  suspension?: SubscriptionSuspensionResponse;
  providerType: ProviderType;
  paymentSource?: PaymentSourceResponse;

  constructor(response: any) {
    super(response);
    this.status = this.getResponseProperty("status");
    this.currentPeriodEndDate = this.getResponseProperty("currentPeriodEndDate");
    this.discountPercentage = this.getResponseProperty("discountPercentage");
    this.collectionMethod = this.getResponseProperty("collectionMethod");
    const plans = this.getResponseProperty("plans");
    if (plans != null) {
      this.plans = plans.map((plan: any) => new ProviderPlanResponse(plan));
    }
    this.accountCredit = this.getResponseProperty("accountCredit");
    const taxInformation = this.getResponseProperty("taxInformation");
    if (taxInformation != null) {
      this.taxInformation = new TaxInfoResponse(taxInformation);
    }
    this.cancelAt = this.getResponseProperty("cancelAt");
    const suspension = this.getResponseProperty("suspension");
    if (suspension != null) {
      this.suspension = new SubscriptionSuspensionResponse(suspension);
    }
    this.providerType = this.getResponseProperty("providerType");
    const paymentSource = this.getResponseProperty("paymentSource");
    if (paymentSource != null) {
      this.paymentSource = new PaymentSourceResponse(paymentSource);
    }
  }
}

export class ProviderPlanResponse extends BaseResponse {
  planName: string;
  seatMinimum: number;
  assignedSeats: number;
  purchasedSeats: number;
  cost: number;
  cadence: string;
  type: PlanType;
  productTier: ProductTierType;

  constructor(response: any) {
    super(response);
    this.planName = this.getResponseProperty("PlanName");
    this.seatMinimum = this.getResponseProperty("SeatMinimum");
    this.assignedSeats = this.getResponseProperty("AssignedSeats");
    this.purchasedSeats = this.getResponseProperty("PurchasedSeats");
    this.cost = this.getResponseProperty("Cost");
    this.cadence = this.getResponseProperty("Cadence");
    this.type = this.getResponseProperty("Type");
    this.productTier = this.getResponseProperty("ProductTier");
  }
}
