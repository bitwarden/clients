import { inject, Injectable } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { adaptInvoicePreviewToCart, Cart, InvoicePreviewFlowContext } from "@bitwarden/pricing";

import {
  InvoicePreviewClient,
  OrganizationPlanChangePreviewRequest,
  OrganizationPurchasePreviewRequest,
  PremiumOrgUpgradePreviewRequest,
  PremiumPurchasePreviewRequest,
} from "../clients/invoice-preview.client";

/**
 * Fetches server-calculated invoice previews and adapts them into render-ready {@link Cart}s
 * that bind directly to `<billing-cart-summary>`.
 *
 * When the preview-driven cart feature flag (PM-36631) is on, checkout screens call this service
 * instead of deriving cart contents locally. Each method serves exactly one checkout flow and
 * supplies that flow's `InvoicePreviewFlowContext` internally, so components never pass a flow
 * context and cannot pick the wrong translation copy for their screen.
 */
@Injectable({ providedIn: "root" })
export class InvoicePreviewService {
  private invoicePreviewClient = inject(InvoicePreviewClient);
  private logService = inject(LogService);

  previewPremiumPurchaseCart = async (request: PremiumPurchasePreviewRequest): Promise<Cart> => {
    const preview = await this.invoicePreviewClient.previewPremiumPurchase(request);

    return adaptInvoicePreviewToCart(
      preview,
      InvoicePreviewFlowContext.PersonalCheckout,
      this.logService,
    );
  };

  previewFamiliesPurchaseCart = async (
    request: OrganizationPurchasePreviewRequest,
  ): Promise<Cart> => {
    const preview = await this.invoicePreviewClient.previewOrganizationPurchase(request);

    return adaptInvoicePreviewToCart(
      preview,
      InvoicePreviewFlowContext.PersonalCheckout,
      this.logService,
    );
  };

  previewPremiumOrgUpgradeCart = async (
    request: PremiumOrgUpgradePreviewRequest,
  ): Promise<Cart> => {
    const preview = await this.invoicePreviewClient.previewPremiumOrgUpgrade(request);

    return adaptInvoicePreviewToCart(
      preview,
      InvoicePreviewFlowContext.PremiumOrgUpgrade,
      this.logService,
    );
  };

  /**
   * Shares a route with {@link previewFamiliesPurchaseCart}; the two differ only in flow context.
   */
  previewOrganizationCheckoutCart = async (
    request: OrganizationPurchasePreviewRequest,
  ): Promise<Cart> => {
    const preview = await this.invoicePreviewClient.previewOrganizationPurchase(request);

    return adaptInvoicePreviewToCart(
      preview,
      InvoicePreviewFlowContext.OrganizationCheckout,
      this.logService,
    );
  };

  previewPlanChangeCart = async (
    organizationId: string,
    request: OrganizationPlanChangePreviewRequest,
  ): Promise<Cart> => {
    const preview = await this.invoicePreviewClient.previewOrganizationPlanChange(
      organizationId,
      request,
    );

    return adaptInvoicePreviewToCart(
      preview,
      InvoicePreviewFlowContext.OrganizationPlanChange,
      this.logService,
    );
  };
}
