import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { BillingAddress } from "@bitwarden/web-vault/app/billing/payment/types";

class TaxAmountResponse extends BaseResponse implements TaxAmounts {
  tax: number;
  total: number;

  constructor(response: any) {
    super(response);

    this.tax = this.getResponseProperty("Tax");
    this.total = this.getResponseProperty("Total");
  }
}

export type OrganizationSubscriptionPlan = {
  tier: "families" | "teams" | "enterprise";
  cadence: "annually" | "monthly";
};

export type OrganizationSubscriptionPurchase = OrganizationSubscriptionPlan & {
  passwordManager: {
    seats: number;
    additionalStorage: number;
    sponsored: boolean;
  };
  secretsManager?: {
    seats: number;
    additionalServiceAccounts: number;
    standalone: boolean;
  };
};

export type OrganizationSubscriptionUpdate = {
  passwordManager?: {
    seats?: number;
    additionalStorage?: number;
  };
  secretsManager?: {
    seats?: number;
    additionalServiceAccounts?: number;
  };
};

export interface TaxAmounts {
  tax: number;
  total: number;
}

@Injectable()
export class TaxClient {
  constructor(private apiService: ApiService) {}

  previewTaxForOrganizationSubscriptionPurchase = async (
    purchase: OrganizationSubscriptionPurchase,
    billingAddress: BillingAddress,
  ): Promise<TaxAmounts> => {
    const json = await this.apiService.send(
      "POST",
      "/billing/tax/organizations/subscriptions/purchase",
      {
        purchase,
        billingAddress,
      },
      true,
      true,
    );

    return new TaxAmountResponse(json);
  };

  previewTaxForOrganizationSubscriptionPlanChange = async (
    organizationId: string,
    plan: {
      tier: "families" | "teams" | "enterprise";
      cadence: "annually" | "monthly";
    },
    billingAddress: BillingAddress | null,
  ): Promise<TaxAmounts> => {
    const json = await this.apiService.send(
      "POST",
      `/billing/tax/organizations/${organizationId}/subscription/plan-change`,
      {
        plan,
        billingAddress,
      },
      true,
      true,
    );

    return new TaxAmountResponse(json);
  };

  previewTaxForOrganizationSubscriptionUpdate = async (
    organizationId: string,
    update: OrganizationSubscriptionUpdate,
  ): Promise<TaxAmounts> => {
    const json = await this.apiService.send(
      "POST",
      `/billing/tax/organizations/${organizationId}/subscription/update`,
      {
        update,
      },
      true,
      true,
    );

    return new TaxAmountResponse(json);
  };

  previewTaxForPremiumSubscriptionPurchase = async (
    additionalStorage: number,
    billingAddress: BillingAddress,
  ): Promise<TaxAmounts> => {
    const json = await this.apiService.send(
      "POST",
      `/billing/tax/premium/subscriptions/purchase`,
      {
        additionalStorage,
        billingAddress,
      },
      true,
      true,
    );

    return new TaxAmountResponse(json);
  };
}
