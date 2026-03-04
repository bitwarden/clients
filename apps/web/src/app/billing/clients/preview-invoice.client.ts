import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
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

export class ProrationPreviewResponse extends BaseResponse {
  tax: number;
  total: number;
  credit: number;
  newPlanProratedMonths: number;
  newPlanProratedAmount: number;

  constructor(response: any) {
    super(response);

    this.tax = this.getResponseProperty("Tax");
    this.total = this.getResponseProperty("Total");
    this.credit = this.getResponseProperty("Credit");
    this.newPlanProratedMonths = this.getResponseProperty("NewPlanProratedMonths");
    this.newPlanProratedAmount = this.getResponseProperty("NewPlanProratedAmount");
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
export class PreviewInvoiceClient {
  constructor(private apiService: ApiService) {}

  previewTaxForOrganizationSubscriptionPurchase = async (
    purchase: OrganizationSubscriptionPurchase,
    billingAddress: BillingAddress,
  ): Promise<TaxAmounts> => {
    const json = await this.apiService.send(
      "POST",
      "/billing/preview-invoice/organizations/subscriptions/purchase",
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
      `/billing/preview-invoice/organizations/${organizationId}/subscription/plan-change`,
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
      `/billing/preview-invoice/organizations/${organizationId}/subscription/update`,
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
      `/billing/preview-invoice/premium/subscriptions/purchase`,
      {
        additionalStorage,
        billingAddress,
      },
      true,
      true,
    );

    return new TaxAmountResponse(json);
  };

  previewProrationForPremiumUpgrade = async (
    planTier: ProductTierType,
    billingAddress: Pick<BillingAddress, "country" | "postalCode">,
  ): Promise<ProrationPreviewResponse> => {
    const prorationResponse = await this.apiService.send(
      "POST",
      `/billing/preview-invoice/premium/subscriptions/upgrade`,
      {
        targetProductTierType: planTier,
        billingAddress,
      },
      true,
      true,
    );

    return new ProrationPreviewResponse(prorationResponse);
  };
}
