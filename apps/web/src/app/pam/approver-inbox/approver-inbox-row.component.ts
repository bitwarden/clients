import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";

import {
  ButtonModule,
  CardComponent,
  FormFieldModule,
  IconModule,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import { AccessRequestDetailsResponse, AccessDecisionVerdict } from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Render a single pending lease request and capture an approve/deny decision.
 *
 * The parent owns the network call; this component emits {@link decide} once
 * per click. Self-approval is disabled at the button level — gating is the
 * parent's responsibility via {@link canDecide}.
 */

@Component({
  selector: "app-pam-approver-inbox-row",
  templateUrl: "./approver-inbox-row.component.html",
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    I18nPipe,
    ButtonModule,
    CardComponent,
    FormFieldModule,
    IconModule,
    TooltipDirective,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApproverInboxRowComponent {
  /** The request to render. */
  readonly request = input.required<AccessRequestDetailsResponse>();
  /**
   * Whether the current user can take a decision on this row.
   * False for self-requests; the buttons render disabled with a tooltip.
   */
  readonly canDecide = input<boolean>(true);
  /** Stable "now" reference for the elapsed-time calculation. */
  readonly now = input<Date>(new Date());

  /** Emitted once per confirmed decision; parent makes the network call. */
  readonly decide = output<{ verdict: AccessDecisionVerdict; comment: string | undefined }>();

  protected readonly commentControl = new FormControl<string>("", { nonNullable: true });
  protected readonly pendingDecision = signal<AccessDecisionVerdict | null>(null);
  protected readonly submitting = signal<boolean>(false);

  protected readonly reasonText = computed(() => this.request().reason?.trim() || null);

  protected readonly elapsedKey = computed(() =>
    elapsedKey(this.request().submittedAt, this.now()),
  );

  protected readonly durationLabel = computed(() => {
    const seconds = this.request().requestedTtlSeconds;
    if (seconds < 3600) {
      return { key: "pamInboxDurationMinutes", value: Math.max(1, Math.round(seconds / 60)) };
    }
    const hours = seconds / 3600;
    if (hours === 1) {
      return { key: "pamInboxDuration1Hour", value: null };
    }
    return {
      key: "pamInboxDurationHours",
      value: Number.isInteger(hours) ? hours : Math.round(hours * 10) / 10,
    };
  });

  protected readonly relativeStart = computed(() => {
    const nb = this.request().requestedNotBefore;
    if (!nb) {
      return { key: "pamInboxStartAsap", value: null };
    }
    const start = new Date(Date.parse(nb));
    const now = this.now();
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.round((startDay - today) / 86_400_000);
    if (diffDays <= 0) {
      return { key: "pamInboxStartToday", value: null };
    }
    if (diffDays === 1) {
      return { key: "pamInboxStartTomorrow", value: null };
    }
    return { key: "pamInboxStartInDays", value: diffDays };
  });

  protected readonly exactWindow = computed(() => {
    const r = this.request();
    if (!r.requestedNotBefore || !r.requestedNotAfter) {
      return "";
    }
    const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });
    return `${fmt.format(new Date(r.requestedNotBefore))} – ${fmt.format(new Date(r.requestedNotAfter))}`;
  });

  protected beginDecision(decision: AccessDecisionVerdict): void {
    if (!this.canDecide() || this.submitting()) {
      return;
    }
    this.pendingDecision.set(decision);
  }

  protected cancelDecision(): void {
    if (this.submitting()) {
      return;
    }
    this.pendingDecision.set(null);
    this.commentControl.reset("");
  }

  protected async confirmDecision(): Promise<void> {
    const decision = this.pendingDecision();
    if (decision == null || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    const comment = this.commentControl.value.trim();
    this.decide.emit({ verdict: decision, comment: comment.length > 0 ? comment : undefined });
  }

  /**
   * Reset the row to its idle state. Called by the parent when a decision
   * fails so the user can retry.
   */
  resetAfterFailure(): void {
    this.submitting.set(false);
  }
}

/**
 * Compute a coarse, i18n-key-friendly elapsed-time bucket. Returning a key
 * (rather than formatted text) keeps localization in the template.
 *
 * Exported for testing.
 */
export function elapsedKey(submittedAt: string, now: Date): { key: string; value: number } {
  const submittedMs = Date.parse(submittedAt);
  if (Number.isNaN(submittedMs)) {
    return { key: "pamInboxElapsedJustNow", value: 0 };
  }
  const diffMs = Math.max(0, now.getTime() - submittedMs);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return { key: "pamInboxElapsedJustNow", value: 0 };
  }
  if (minutes < 60) {
    return { key: "pamInboxElapsedMinutes", value: minutes };
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return { key: "pamInboxElapsedHours", value: hours };
  }
  const days = Math.floor(hours / 24);
  return { key: "pamInboxElapsedDays", value: days };
}
