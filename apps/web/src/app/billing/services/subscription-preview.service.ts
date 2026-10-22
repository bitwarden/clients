import { inject, Injectable } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { adaptInvoicePreviewToCart, InvoicePreviewFlowContext } from "@bitwarden/pricing";
import { SubscriptionPreview } from "@bitwarden/subscription";

import { SubscriptionPreviewClient } from "../clients/subscription-preview.client";

/**
 * The only entry point flag-ON screens use for subscription previews. Each method bakes the flow
 * context for its surface and returns a `SubscriptionPreview` whose inner cart is already adapted.
 */
@Injectable({ providedIn: "root" })
export class SubscriptionPreviewService {
  private subscriptionPreviewClient = inject(SubscriptionPreviewClient);
  private logService = inject(LogService);

  getAccountSubscriptionPreview = async (): Promise<SubscriptionPreview> => {
    const response = await this.subscriptionPreviewClient.getAccountSubscriptionPreview();

    const cart = adaptInvoicePreviewToCart(
      response.invoicePreview,
      InvoicePreviewFlowContext.PremiumSubscriptionPage,
      this.logService,
    );

    return response.toDomain(cart);
  };

  getOrganizationSubscriptionPreview = async (
    organizationId: string,
  ): Promise<SubscriptionPreview> => {
    const response =
      await this.subscriptionPreviewClient.getOrganizationSubscriptionPreview(organizationId);

    const cart = adaptInvoicePreviewToCart(
      response.invoicePreview,
      InvoicePreviewFlowContext.OrganizationSubscriptionPage,
      this.logService,
    );

    return response.toDomain(cart);
  };
}
