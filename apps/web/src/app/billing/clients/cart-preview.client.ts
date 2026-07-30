import { inject, Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CartPreviewResponse } from "@bitwarden/common/billing/models/response/cart-preview.response";

/**
 * Request shapes are owned by the per-screen tickets that consume each route. They are kept
 * minimal and narrowly typed here rather than `any`, and will be filled out as those land.
 */
// TODO(PM-40222): finalize the premium purchase request shape.
export type PremiumPurchasePreviewRequest = {
  additionalStorage: number;
};

// TODO(PM-40223): finalize the premium organization upgrade request shape.
export type PremiumOrgUpgradePreviewRequest = {
  planTier: string;
  cadence: string;
};

// TODO(PM-40222 / PM-40231): finalize the shared organization purchase request shape.
export type OrganizationPurchasePreviewRequest = {
  planTier: string;
  cadence: string;
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

// TODO(PM-40224): finalize the organization plan change request shape.
export type OrganizationPlanChangePreviewRequest = {
  planTier: string;
  cadence: string;
};

/**
 * Raw HTTP access to the cart preview endpoints. No adaptation and no flow context — callers go
 * through `CartPreviewService`, which owns both.
 *
 * Every route below is gated server-side by the `PM36631_PreviewDrivenCart` flag and returns 404
 * until the corresponding server ticket lands. 404s deliberately propagate: while the routes do
 * not exist, "route missing" must stay distinguishable from "no subscription".
 */
@Injectable({ providedIn: "root" })
export class CartPreviewClient {
  private apiService = inject(ApiService);

  /** Consumed by PM-40222. */
  previewPremiumPurchase = async (
    request: PremiumPurchasePreviewRequest,
  ): Promise<CartPreviewResponse> => {
    const json = await this.apiService.send(
      "POST",
      "/account/billing/subscriptions/premium/invoice/preview",
      request,
      true,
      true,
    );

    return new CartPreviewResponse(json);
  };

  /** Consumed by PM-40223. */
  previewPremiumOrgUpgrade = async (
    request: PremiumOrgUpgradePreviewRequest,
  ): Promise<CartPreviewResponse> => {
    const json = await this.apiService.send(
      "POST",
      "/account/billing/subscriptions/premium/upgrade/invoice/preview",
      request,
      true,
      true,
    );

    return new CartPreviewResponse(json);
  };

  /** Shared route, consumed by PM-40222 (personal checkout) and PM-40231 (organization checkout). */
  previewOrganizationPurchase = async (
    request: OrganizationPurchasePreviewRequest,
  ): Promise<CartPreviewResponse> => {
    const json = await this.apiService.send(
      "POST",
      "/account/billing/subscriptions/organizations/invoice/preview",
      request,
      true,
      true,
    );

    return new CartPreviewResponse(json);
  };

  /** Consumed by PM-40224. */
  previewOrganizationPlanChange = async (
    organizationId: string,
    request: OrganizationPlanChangePreviewRequest,
  ): Promise<CartPreviewResponse> => {
    const json = await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/billing/subscription/plan-change/invoice/preview`,
      request,
      true,
      true,
    );

    return new CartPreviewResponse(json);
  };
}
