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
 * `Cart` has no month field, so the Premium-to-organization upgrade returns the prorated month
 * count alongside it for the seat label. TODO(PM-40231): fold into the adapter, return a plain `Cart`.
 */
export type CartWithProratedMonths = {
  cart: Cart;
  proratedMonths: number;
};

/**
 * Fetches server-calculated invoice previews and adapts them into render-ready {@link Cart}s
 * that bind directly to `<billing-cart-summary>`.
 *
 * When the preview-driven cart feature flag (PM-36631) is on, checkout screens call this service
 * instead of deriving cart contents locally. Each method serves exactly one checkout flow and
 * supplies that flow's `InvoicePreviewFlowContext` internally, so components never pass a flow
 * context and cannot pick the wrong translation copy for their screen. The Premium-to-organization
 * upgrade additionally returns the prorated month count alongside its cart (see
 * {@link previewPremiumOrgUpgradeCart}).
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

  /** A single-seat swap yields at most one Password Manager proration, hence `prorations[0]`. */
  previewPremiumOrgUpgradeCart = async (
    request: PremiumOrgUpgradePreviewRequest,
  ): Promise<CartWithProratedMonths> => {
    const preview = await this.invoicePreviewClient.previewPremiumOrgUpgrade(request);

    return {
      cart: adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        this.logService,
      ),
      proratedMonths: preview.passwordManager.prorations?.[0]?.months ?? 0,
    };
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
