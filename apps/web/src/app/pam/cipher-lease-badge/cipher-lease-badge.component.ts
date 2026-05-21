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
import { GatedState } from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "app-cipher-lease-badge",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TooltipDirective, I18nPipe],
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
      case "gated_no_lease_auto":
        return this.i18nService.t("cipherLeaseAutomatedEvaluation");
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

export function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes - hours * 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
