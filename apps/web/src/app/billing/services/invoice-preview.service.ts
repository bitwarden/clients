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
 * The only entry point flag-ON screens use for cart previews. Each method bakes the flow context
 * for its surface, so components never pass one and cannot pick the wrong copy for their screen.
 *
 * Returns a render-ready `Cart` that binds straight to `<billing-cart-summary>`.
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
