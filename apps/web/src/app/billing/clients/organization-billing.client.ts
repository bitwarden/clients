import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrganizationWarningsResponse } from "@bitwarden/web-vault/app/billing/organizations/warnings/types";

export class ChurnMitigationOfferResponseModel extends BaseResponse {
  couponId: string;
  percentOff: number | null;
  amountOff: number | null;
  durationDescription: string;
  name: string;

  constructor(response: any) {
    super(response);
    this.couponId = this.getResponseProperty("CouponId");
    this.percentOff = this.getResponseProperty("PercentOff");
    this.amountOff = this.getResponseProperty("AmountOff");
    this.durationDescription = this.getResponseProperty("DurationDescription");
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
    // TODO: remove stub once PM-37170 is deployed to dev
    return new ChurnMitigationOfferResponseModel({
      CouponId: "test-coupon",
      PercentOff: 10,
      AmountOff: null,
      DurationDescription: "1 year",
      Name: "10% Off for 1 Year",
    });
    try {
      const response = await this.apiService.send(
        "GET",
        `/organizations/${organizationId}/billing/churn-offer`,
        null,
        true,
        true,
      );
      return response ? new ChurnMitigationOfferResponseModel(response) : null;
    } catch (error: any) {
      if (error instanceof ErrorResponse && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  };

  redeemChurnOffer = async (organizationId: OrganizationId): Promise<void> => {
    return;
    await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/billing/churn-offer/redeem`,
      null,
      true,
      false,
    );
  };
}
