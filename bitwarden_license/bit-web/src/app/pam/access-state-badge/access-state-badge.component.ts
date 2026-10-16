import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { EMPTY, switchMap } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BadgeComponent, BadgeVariant } from "@bitwarden/components";

import { formatRemaining } from "../date/format-remaining";

import {
  ACCESS_BADGE_LOOK,
  AccessBadgeState,
  ENDING_SOON_THRESHOLD_MS,
} from "./access-badge-state";
import { AccessBadgeTickerService } from "./access-badge-ticker.service";

type BadgeIcon =
  "bwi-key" | "bwi-clock" | "bwi-lock" | "bwi-unlock" | "bwi-check" | "bwi-exclamation-triangle";

type BadgeRecipe = {
  readonly variant: BadgeVariant;
  readonly icon: BadgeIcon;
  readonly label: string;
  readonly testId: string;
};

/**
 * The access-state pill for a gated item. Callers resolve the state (e.g. via
 * `cipherAccessBadgeState`); this owns the recipe, the ending-soon escalation and the countdown.
 */
@Component({
  selector: "app-pam-access-state-badge",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  templateUrl: "./access-state-badge.component.html",
})
export class AccessStateBadgeComponent {
  readonly state = input.required<AccessBadgeState | null>();

  private readonly i18nService = inject(I18nService);
  private readonly locale = inject(LOCALE_ID);
  private readonly ticker = inject(AccessBadgeTickerService);

  /** Only an active badge subscribes to the ticker, so resting badges let the shared timer stop. */
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
        // The lease lapsed locally before a refetch — show "Session ended".
        return this.staticRecipe("expired");
      }
      const remaining = formatRemaining(this.locale, remainingMs);
      if (remainingMs <= ENDING_SOON_THRESHOLD_MS) {
        return {
          ...ACCESS_BADGE_LOOK.endingSoon,
          label: this.i18nService.t("pamAccessBadgeEndingSoon", remaining),
          testId: "access-state-badge-ending-soon",
        };
      }
      return {
        ...ACCESS_BADGE_LOOK.active,
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
          ...ACCESS_BADGE_LOOK.privileged,
          label: this.i18nService.t("pamAccessBadgePrivileged"),
          testId: "access-state-badge-privileged",
        };
      case "pending":
        return {
          ...ACCESS_BADGE_LOOK.pending,
          label: this.i18nService.t("pamAccessBadgePending"),
          testId: "access-state-badge-pending",
        };
      case "unavailable":
        return {
          ...ACCESS_BADGE_LOOK.unavailable,
          label: this.i18nService.t("pamAccessBadgeUnavailable"),
          testId: "access-state-badge-unavailable",
        };
      case "ready":
        return {
          ...ACCESS_BADGE_LOOK.ready,
          label: this.i18nService.t("pamAccessBadgeReady"),
          testId: "access-state-badge-ready",
        };
      case "expired":
        return {
          ...ACCESS_BADGE_LOOK.expired,
          label: this.i18nService.t("pamAccessBadgeEnded"),
          testId: "access-state-badge-expired",
        };
    }
  }
}
