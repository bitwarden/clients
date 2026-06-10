import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrganizationWarningsResponse } from "@bitwarden/web-vault/app/billing/organizations/warnings/types";

type ChurnMitigationOfferDuration = "once" | "repeating" | "forever";

export class ChurnMitigationOfferResponseModel extends BaseResponse {
  couponId: string;
  percentOff: number | null;
  duration: ChurnMitigationOfferDuration;
  durationInMonths: number | null;
  name: string;

  constructor(response: any) {
    super(response);
    this.couponId = this.getResponseProperty("CouponId");
    this.percentOff = this.getResponseProperty("PercentOff");
    this.duration = this.getResponseProperty("Duration");
    this.durationInMonths = this.getResponseProperty("DurationInMonths");
    this.name = this.getResponseProperty("Name");
  }

  /**
   * Human-readable description of the period the discount covers.
   *
   * @param billingInterval the subscription's billing cadence, used for `once`-duration
   * coupons which have no `durationInMonths` of their own and instead cover a single
   * subscription billing period (e.g. "year" for an annual plan, "month" for a monthly plan).
   */
  getDurationDescription(billingInterval: "year" | "month"): string {
    if (this.duration === "forever") {
      return "forever";
    }

    if (this.durationInMonths === 12) {
      return "year";
    }

    if (this.durationInMonths === 1) {
      return "month";
    }

    if (this.durationInMonths != null) {
      return `${this.durationInMonths} months`;
    }

    return billingInterval;
  }

  /**
   * Splits the discount period into a quantity and a unit, for summary copy of the
   * form "{length} {unit}" (e.g. "1 year", "3 months").
   *
   * @param billingInterval the subscription's billing cadence, used for `once`-duration
   * coupons which cover a single subscription billing period.
   */
  getDurationParts(billingInterval: "year" | "month"): { length: string; unit: string } {
    if (this.duration === "forever") {
      return { length: "", unit: "forever" };
    }

    if (this.durationInMonths != null) {
      if (this.durationInMonths % 12 === 0) {
        const years = this.durationInMonths / 12;
        return { length: `${years}`, unit: years === 1 ? "year" : "years" };
      }

      return {
        length: `${this.durationInMonths}`,
        unit: this.durationInMonths === 1 ? "month" : "months",
      };
    }

    // `once`-duration coupons cover a single subscription billing period.
    return { length: "1", unit: billingInterval };
  }
}

@Injectable({ providedIn: "root" })
export class OrganizationBillingClient {
  constructor(private apiService: ApiService) {}

  getWarnings = async (organizationId: OrganizationId): Promise<OrganizationWarningsResponse> => {
    const response = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/billing/vnext/warnings`,
      null,
      true,
      true,
    );

    return new OrganizationWarningsResponse(response);
  };

  getChurnOffer = async (
    organizationId: OrganizationId,
  ): Promise<ChurnMitigationOfferResponseModel | null> => {
    // TODO: remove local stub before merging.
    return new ChurnMitigationOfferResponseModel({
      CouponId: "churn-15-percent-once",
      PercentOff: 15,
      Duration: "once",
      DurationInMonths: null,
      Name: "Churn 15% off",
    });

    const response = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/billing/vnext/churn-mitigation-offer`,
      null,
      true,
      true,
    );
    return response ? new ChurnMitigationOfferResponseModel(response) : null;
  };

  redeemChurnOffer = async (organizationId: OrganizationId): Promise<void> => {
    return Promise.resolve();
    await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/billing/vnext/churn-mitigation-offer/redeem`,
      null,
      true,
      false,
    );
  };
}
