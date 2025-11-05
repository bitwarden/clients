// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";

import { BillingCustomerDiscountResponse } from "@bitwarden/common/billing/models/response/subscription.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

@Component({
  selector: "app-discount-badge",
  templateUrl: "./discount-badge.component.html",
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscountBadgeComponent {
  readonly customerDiscount = input<BillingCustomerDiscountResponse | null>(null);

  private i18nService = inject(I18nService);

  getDiscountText(): string | null {
    const discount = this.customerDiscount();
    if (!discount) {
      return null;
    }

    if (discount.percentOff != null && discount.percentOff > 0) {
      const percentValue =
        discount.percentOff < 1 ? discount.percentOff * 100 : discount.percentOff;
      return `${Math.round(percentValue)}% ${this.i18nService.t("discount")}`;
    }

    if (discount.amountOff != null && discount.amountOff > 0) {
      const formattedAmount = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(discount.amountOff);
      return `${formattedAmount} ${this.i18nService.t("discount")}`;
    }

    return null;
  }

  hasDiscount(): boolean {
    const discount = this.customerDiscount();
    if (!discount) {
      return false;
    }
    if (!discount.active) {
      return false;
    }
    return (
      (discount.percentOff != null && discount.percentOff > 0) ||
      (discount.amountOff != null && discount.amountOff > 0)
    );
  }
}
