import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BadgeModule } from "@bitwarden/components";

import { Discount, getLabel } from "../../types/discount";
import { Maybe } from "../../types/maybe";

@Component({
  selector: "billing-discount-badge",
  templateUrl: "./discount-badge.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, BadgeModule],
})
export class DiscountBadgeComponent {
  private i18nService = inject(I18nService);

  readonly discount = input<Maybe<Discount>>(null);

  readonly display = computed<boolean>(() => {
    const discount = this.discount();
    if (!discount) {
      return false;
    }
    return discount.active && discount.value > 0;
  });

  readonly label = computed<Maybe<string>>(() => {
    const discount = this.discount();
    if (discount) {
      return getLabel(this.i18nService, discount);
    }
  });
}
