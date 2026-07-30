import { inject, Injectable } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { adaptCartPreviewToCart, Cart, CartPreviewFlowContext } from "@bitwarden/pricing";

import {
  CartPreviewClient,
  OrganizationPlanChangePreviewRequest,
  OrganizationPurchasePreviewRequest,
  PremiumOrgUpgradePreviewRequest,
  PremiumPurchasePreviewRequest,
} from "../clients/cart-preview.client";

/**
 * The only entry point flag-ON screens use for cart previews. Each method bakes the flow context
 * for its surface, so components never pass one and cannot pick the wrong copy for their screen.
 *
 * Returns a render-ready `Cart` that binds straight to `<billing-cart-summary>`.
 */
@Injectable({ providedIn: "root" })
export class CartPreviewService {
  private cartPreviewClient = inject(CartPreviewClient);
  private logService = inject(LogService);

  previewPremiumPurchaseCart = async (request: PremiumPurchasePreviewRequest): Promise<Cart> => {
    const preview = await this.cartPreviewClient.previewPremiumPurchase(request);

    return adaptCartPreviewToCart(
      preview,
      CartPreviewFlowContext.PersonalCheckout,
      this.logService,
    );
  };

  previewFamiliesPurchaseCart = async (
    request: OrganizationPurchasePreviewRequest,
  ): Promise<Cart> => {
    const preview = await this.cartPreviewClient.previewOrganizationPurchase(request);

    return adaptCartPreviewToCart(
      preview,
      CartPreviewFlowContext.PersonalCheckout,
      this.logService,
    );
  };

  previewPremiumOrgUpgradeCart = async (
    request: PremiumOrgUpgradePreviewRequest,
  ): Promise<Cart> => {
    const preview = await this.cartPreviewClient.previewPremiumOrgUpgrade(request);

    return adaptCartPreviewToCart(
      preview,
      CartPreviewFlowContext.PremiumOrgUpgrade,
      this.logService,
    );
  };

  /**
   * Shares a route with {@link previewFamiliesPurchaseCart}; the two differ only in flow context.
   */
  previewOrganizationCheckoutCart = async (
    request: OrganizationPurchasePreviewRequest,
  ): Promise<Cart> => {
    const preview = await this.cartPreviewClient.previewOrganizationPurchase(request);

    return adaptCartPreviewToCart(
      preview,
      CartPreviewFlowContext.OrganizationCheckout,
      this.logService,
    );
  };

  previewPlanChangeCart = async (
    organizationId: string,
    request: OrganizationPlanChangePreviewRequest,
  ): Promise<Cart> => {
    const preview = await this.cartPreviewClient.previewOrganizationPlanChange(
      organizationId,
      request,
    );

    return adaptCartPreviewToCart(
      preview,
      CartPreviewFlowContext.OrganizationPlanChange,
      this.logService,
    );
  };
}
