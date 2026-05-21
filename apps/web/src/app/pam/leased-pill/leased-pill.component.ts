import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BadgeComponent, TooltipDirective } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Sub-states for the leased pill.
 *   - "active"            → lease is live, countdown ticking.
 *   - "extension_pending" → extension submitted but awaiting human approval.
 */
export const LeasedPillState = Object.freeze({
  Active: "active",
  ExtensionPending: "extension_pending",
} as const);
export type LeasedPillState = (typeof LeasedPillState)[keyof typeof LeasedPillState];

/**
 * Formats a millisecond duration into a human-readable countdown string.
 * Exported so tests and the extension modal can share the same logic.
 */
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

/**
 * Leased pill — displays an active lease with a ticking countdown and an
 * "extension pending" sub-state. Clicking the pill emits {@link openExtension}
 * so the parent can open the extension modal (PM-37266).
 *
 * Placement in the cipher view is TBD pending the design hand-off.
 *
 * The countdown re-syncs on `visibilitychange` so it remains accurate even
 * when the tab is backgrounded (setInterval drifts when throttled).
 */
@Component({
  selector: "pam-leased-pill",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, BadgeComponent, TooltipDirective, I18nPipe],
  templateUrl: "./leased-pill.component.html",
})
export class LeasedPillComponent {
  /** ISO-8601 string for when the current lease expires. */
  readonly notAfter = input.required<string>();

  /** Whether an extension request is currently awaiting approval. */
  readonly extensionPending = input<boolean>(false);

  /** Emitted when the user clicks the pill to open the extension flow. */
  readonly openExtension = output<void>();

  private readonly i18nService = inject(I18nService);

  private readonly nowMs = signal(Date.now());

  protected readonly pillState = computed<LeasedPillState>(() =>
    this.extensionPending() ? LeasedPillState.ExtensionPending : LeasedPillState.Active,
  );

  protected readonly expiresAtMs = computed(() => {
    const parsed = Date.parse(this.notAfter());
    return Number.isNaN(parsed) ? 0 : parsed;
  });

  protected readonly remainingLabel = computed(() =>
    formatRemaining(this.expiresAtMs() - this.nowMs()),
  );

  protected readonly tooltip = computed(() => {
    if (this.pillState() === LeasedPillState.ExtensionPending) {
      return this.i18nService.t("leasedPillExtensionPendingTooltip");
    }
    return this.i18nService.t("leasedPillActiveTooltip", this.remainingLabel());
  });

  constructor() {
    // Tick every second. Re-syncs on visibility to correct any throttle drift
    // that browsers apply to background tabs.
    effect((onCleanup) => {
      const tick = () => this.nowMs.set(Date.now());

      const intervalId = setInterval(tick, 1000);
      const onVisible = () => {
        if (document.visibilityState === "visible") {
          tick();
        }
      };
      document.addEventListener("visibilitychange", onVisible);

      onCleanup(() => {
        clearInterval(intervalId);
        document.removeEventListener("visibilitychange", onVisible);
      });
    });
  }

  protected handleClick(): void {
    this.openExtension.emit();
  }
}
