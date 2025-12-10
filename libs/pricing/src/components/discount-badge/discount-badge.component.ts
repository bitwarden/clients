import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BadgeModule } from "@bitwarden/components";

/**
 * Interface for discount information that can be displayed in the discount badge.
 * This is abstracted from the response class to avoid tight coupling.
 */
export interface DiscountInfo {
  /** Whether the discount is currently active */
  active: boolean;
  /** Percentage discount (0-100 or 0-1 scale) */
  percentOff?: number;
  /** Fixed amount discount in the base currency */
  amountOff?: number;
}

@Component({
  selector: "billing-discount-badge",
  templateUrl: "./discount-badge.component.html",
  standalone: true,
  imports: [CommonModule, BadgeModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscountBadgeComponent {
  readonly discount = input<DiscountInfo | null>(null);

  private i18nService = inject(I18nService);

  getDiscountText(): string | null {
    const discount = this.discount();
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
    const discount = this.discount();
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
