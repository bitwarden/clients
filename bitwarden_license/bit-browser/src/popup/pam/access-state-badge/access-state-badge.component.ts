import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { EMPTY, switchMap } from "rxjs";

import {
  AccessBadgeState,
  ENDING_SOON_THRESHOLD_MS,
  formatRemaining,
} from "@bitwarden/bit-common/pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BadgeComponent, BadgeVariant } from "@bitwarden/components";

import { AccessBadgeTickerService } from "./access-badge-ticker.service";

type BadgeIcon =
  "bwi-key" | "bwi-clock" | "bwi-lock" | "bwi-unlock" | "bwi-check" | "bwi-exclamation-triangle";

type BadgeRecipe = {
  readonly variant: BadgeVariant;
  readonly icon: BadgeIcon;
  readonly label: string;
  readonly testId: string;
};

/** The access-state pill for a gated item (Figma node 88-1699). Renders nothing when `state` is null. */
@Component({
  selector: "app-pam-access-state-badge",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  templateUrl: "./access-state-badge.component.html",
})
export class AccessStateBadgeComponent {
  readonly state = input.required<AccessBadgeState | null>();

  private readonly i18nService = inject(I18nService);
  private readonly ticker = inject(AccessBadgeTickerService);

  /** Ticks once a second while an active-lease countdown is showing. */
  private readonly now = toSignal(
    toObservable(computed(() => this.state()?.kind === "active")).pipe(
      switchMap((active) => (active ? this.ticker.ticks$ : EMPTY)),
    ),
    { initialValue: Date.now() },
  );

  protected readonly recipe = computed<BadgeRecipe | null>(() => {
    const state = this.state();
    if (state == null) {
      return null;
    }

    if (state.kind === "active") {
      const remainingMs = state.expiresAt.getTime() - this.now();
      if (remainingMs <= 0) {
        return this.staticRecipe("expired");
      }
      const remaining = formatRemaining(remainingMs);
      if (remainingMs <= ENDING_SOON_THRESHOLD_MS) {
        return {
          variant: "danger",
          icon: "bwi-exclamation-triangle",
          label: this.i18nService.t("pamAccessBadgeEndingSoon", remaining),
          testId: "access-state-badge-ending-soon",
        };
      }
      return {
        variant: "accent-primary",
        icon: "bwi-unlock",
        label: this.i18nService.t("pamAccessBadgeTimeLeft", remaining),
        testId: "access-state-badge-active",
      };
    }

    return this.staticRecipe(state.kind);
  });

  private staticRecipe(kind: Exclude<AccessBadgeState["kind"], "active">): BadgeRecipe {
    switch (kind) {
      case "privileged":
        return {
          variant: "primary",
          icon: "bwi-key",
          label: this.i18nService.t("pamAccessBadgePrivileged"),
          testId: "access-state-badge-privileged",
        };
      case "pending":
        return {
          variant: "warning",
          icon: "bwi-clock",
          label: this.i18nService.t("pamAccessBadgePending"),
          testId: "access-state-badge-pending",
        };
      case "unavailable":
        return {
          variant: "subtle",
          icon: "bwi-lock",
          label: this.i18nService.t("pamAccessBadgeUnavailable"),
          testId: "access-state-badge-unavailable",
        };
      case "ready":
        return {
          variant: "success",
          icon: "bwi-check",
          label: this.i18nService.t("pamAccessBadgeReady"),
          testId: "access-state-badge-ready",
        };
      case "expired":
        return {
          variant: "subtle",
          icon: "bwi-lock",
          label: this.i18nService.t("pamAccessBadgeEnded"),
          testId: "access-state-badge-expired",
        };
    }
  }
}
