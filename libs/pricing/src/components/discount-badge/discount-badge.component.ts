import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BadgeModule } from "@bitwarden/components";

import { Discount, getDiscountText } from "../../types/discount";

@Component({
  selector: "billing-discount-badge",
  templateUrl: "./discount-badge.component.html",
  standalone: true,
  imports: [CommonModule, BadgeModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscountBadgeComponent {
  readonly discount = input.required<Discount>();

  readonly display = computed<boolean>(() => {
    const discount = this.discount();
    return discount.active && discount.value > 0;
  });

  readonly text = computed<string>(() => {
    const discount = this.discount();
    return getDiscountText(this.i18nService, discount);
  });

  private i18nService = inject(I18nService);
}
