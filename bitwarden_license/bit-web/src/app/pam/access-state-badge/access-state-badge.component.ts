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
import { BadgeComponent, BadgeVariant } from "@bitwarden/components";

import { formatRemaining } from "../date/format-remaining";

import { AccessBadgeState } from "./access-badge-state";

/** At or below this remaining time an active lease escalates to the danger "Ending soon" badge. */
const ENDING_SOON_THRESHOLD_MS = 5 * 60 * 1000;

/** One of the six glyphs the spec pairs with the access-state badges. */
type BadgeIcon =
  "bwi-key" | "bwi-clock" | "bwi-lock" | "bwi-unlock" | "bwi-check" | "bwi-exclamation-triangle";

type BadgeRecipe = {
  readonly variant: BadgeVariant;
  readonly icon: BadgeIcon;
  readonly label: string;
  readonly testId: string;
};

/**
 * Renders the unified access-state badge for a gated item — the one pill recipe used across the
 * vault row, the cipher-view modal, and the Requests page (Figma node 88-1699). Callers resolve
 * an {@link AccessBadgeState} (e.g. via `cipherAccessBadgeState`) and pass it in; this component
 * owns the colour/icon/copy mapping, the 5-minute danger escalation, and the live countdown so
 * every surface behaves identically. Renders nothing when `state` is null.
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

  /** Ticks once a second while an active-lease countdown is showing so the label stays live. */
  private readonly now = signal(Date.now());

  protected readonly recipe = computed<BadgeRecipe | null>(() => {
    const state = this.state();
    if (state == null) {
      return null;
    }

    if (state.kind === "active") {
      const remainingMs = state.expiresAt.getTime() - this.now();
      if (remainingMs <= 0) {
        // The lease lapsed locally before a refetch — show the resting "Session ended" badge.
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

  constructor() {
    effect((onCleanup) => {
      if (this.state()?.kind !== "active") {
        return;
      }
      const id = setInterval(() => this.now.set(Date.now()), 1000);
      onCleanup(() => clearInterval(id));
    });
  }

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
          label: this.i18nService.t("pamAccessBadgeSessionEnded"),
          testId: "access-state-badge-expired",
        };
    }
  }
}
