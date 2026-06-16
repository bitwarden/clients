import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrganizationWarningsResponse } from "@bitwarden/web-vault/app/billing/organizations/warnings/types";

type ChurnMitigationOfferDuration = "once" | "repeating";

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
    await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/billing/vnext/churn-mitigation-offer/redeem`,
      null,
      true,
      false,
    );
  };
}
