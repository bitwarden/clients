import { inject, Injectable } from "@angular/core";

import { ProductTierType } from "@bitwarden/common/billing/enums";
import { Cart } from "@bitwarden/pricing";

import { OrganizationSubscriptionPurchase } from "../../clients";
import { BillingAddress } from "../../payment/types";
import { InvoicePreviewService } from "../../services/invoice-preview.service";

@Injectable({ providedIn: "root" })
export class OrganizationCheckoutPreviewService {
  private readonly invoicePreviewService = inject(InvoicePreviewService);

  async previewCheckoutCart(
    purchase: OrganizationSubscriptionPurchase,
    billingAddress: BillingAddress,
    couponIds: string[],
  ): Promise<Cart> {
    return this.invoicePreviewService.previewOrganizationCheckoutCart({
      purchase: { ...purchase, ...(couponIds.length ? { coupons: couponIds } : {}) },
      billingAddress,
    });
  }

  async previewPremiumUpgradeCart(
    productTier: ProductTierType,
    billingAddress: BillingAddress,
    planName: string,
  ): Promise<Cart> {
    return this.invoicePreviewService.previewPremiumOrgUpgradeCart(
      {
        targetProductTierType: productTier,
        billingAddress: {
          country: billingAddress.country,
          postalCode: billingAddress.postalCode,
        },
      },
      planName,
    );
  }
}
