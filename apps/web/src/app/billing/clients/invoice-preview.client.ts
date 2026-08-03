// NOTE: `InvoicePreviewClient` (this file) is the preview-driven cart client and is NOT the legacy
// `PreviewInvoiceClient` in `preview-invoice.client.ts`, which returns only (Tax, Total). The two
// coexist until the PM-40422 cleanup — check which one you mean before importing.
import { inject, Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { InvoicePreviewResponse } from "@bitwarden/common/billing/models/response/invoice-preview.response";
import type { PlanTier } from "@bitwarden/pricing";

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
  planTier: PlanTier;
  cadence: string;
};

// TODO(PM-40222 / PM-40231): finalize the shared organization purchase request shape.
export type OrganizationPurchasePreviewRequest = {
  planTier: PlanTier;
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
  planTier: PlanTier;
  cadence: string;
};

/**
 * Raw HTTP access to the cart preview endpoints. No adaptation and no flow context — callers go
 * through `InvoicePreviewService`, which owns both.
 *
 * Every route below is gated server-side by the `PM36631_PreviewDrivenCart` flag and returns 404
 * until the corresponding server ticket lands. 404s deliberately propagate: while the routes do
 * not exist, "route missing" must stay distinguishable from "no subscription".
 */
@Injectable({ providedIn: "root" })
export class InvoicePreviewClient {
  private apiService = inject(ApiService);

  /** Consumed by PM-40222. */
  previewPremiumPurchase = async (
    request: PremiumPurchasePreviewRequest,
  ): Promise<InvoicePreviewResponse> => {
    const json = await this.apiService.send(
      "POST",
      "/account/billing/subscriptions/premium/invoice/preview",
      request,
      true,
      true,
    );

    return new InvoicePreviewResponse(json);
  };

  /** Consumed by PM-40223. */
  previewPremiumOrgUpgrade = async (
    request: PremiumOrgUpgradePreviewRequest,
  ): Promise<InvoicePreviewResponse> => {
    const json = await this.apiService.send(
      "POST",
      "/account/billing/subscriptions/premium/upgrade/invoice/preview",
      request,
      true,
      true,
    );

    return new InvoicePreviewResponse(json);
  };

  /** Shared route, consumed by PM-40222 (personal checkout) and PM-40231 (organization checkout). */
  previewOrganizationPurchase = async (
    request: OrganizationPurchasePreviewRequest,
  ): Promise<InvoicePreviewResponse> => {
    const json = await this.apiService.send(
      "POST",
      "/account/billing/subscriptions/organizations/invoice/preview",
      request,
      true,
      true,
    );

    return new InvoicePreviewResponse(json);
  };

  /** Consumed by PM-40224. */
  previewOrganizationPlanChange = async (
    organizationId: string,
    request: OrganizationPlanChangePreviewRequest,
  ): Promise<InvoicePreviewResponse> => {
    const json = await this.apiService.send(
      "POST",
      `/organizations/${organizationId}/billing/subscription/plan-change/invoice/preview`,
      request,
      true,
      true,
    );

    return new InvoicePreviewResponse(json);
  };
}
