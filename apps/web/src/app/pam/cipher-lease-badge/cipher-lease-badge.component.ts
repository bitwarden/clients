import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconComponent, TooltipDirective } from "@bitwarden/components";
import { GatedState, formatRemaining } from "@bitwarden/pam";

@Component({
  selector: "app-cipher-lease-badge",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TooltipDirective],
  templateUrl: "./cipher-lease-badge.component.html",
})
export class CipherLeaseBadgeComponent {
  readonly state = input.required<GatedState>();
  readonly leaseExpiresAt = input<Date | null>(null);

  private readonly i18nService = inject(I18nService);
  private readonly now = signal(Date.now());

  protected readonly isActiveLease = computed(() => this.state() === "gated_active_lease");

  protected readonly remainingLabel = computed(() => {
    const expiresAt = this.leaseExpiresAt();
    if (expiresAt == null) {
      return "0s";
    }
    return formatRemaining(expiresAt.getTime() - this.now());
  });

  protected readonly tooltip = computed(() => {
    switch (this.state()) {
      case "gated_active_lease":
        return this.i18nService.t("cipherLeaseExpiresIn", this.remainingLabel());
      case "gated_no_lease":
        return this.i18nService.t("cipherLeaseRequiresApproval");
      default:
        return "";
    }
  });

  constructor() {
    effect((onCleanup) => {
      if (!this.isActiveLease()) {
        return;
      }
      const id = setInterval(() => this.now.set(Date.now()), 1000);
      onCleanup(() => clearInterval(id));
    });
  }
}
