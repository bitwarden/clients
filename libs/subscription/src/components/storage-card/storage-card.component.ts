import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, CardComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * A reusable UI-only component that displays a storage usage card with a progress bar
 * and action buttons. This component has no external dependencies and performs no
 * logic - it only displays data and emits events when buttons are clicked.
 */
@Component({
  selector: "billing-storage-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./storage-card.component.html",
  imports: [CommonModule, ButtonModule, CardComponent, TypographyModule, I18nPipe],
})
export class StorageCardComponent {
  private i18nService = inject(I18nService);

  /**
   * The currently used storage in gigabytes (e.g., 1 for 1 GB)
   */
  readonly used = input.required<number>();

  /**
   * The total storage capacity in gigabytes (e.g., 5 for 5 GB)
   */
  readonly total = input.required<number>();

  readonly addStorageClicked = output<void>();
  readonly removeStorageClicked = output<void>();

  readonly usage = computed<number>(() => {
    const total = this.total();
    const used = this.used();
    if (total === 0) {
      return 0;
    }
    return Math.min(100, (used / total) * 100);
  });

  readonly description = computed<string>(() => {
    const used = this.used();
    const total = this.total();
    return this.i18nService.t("youHaveUsedStorage", used.toString(), total.toString());
  });

  readonly isNearlyFull = computed<boolean>(() => {
    return this.usage() >= 95;
  });
}
