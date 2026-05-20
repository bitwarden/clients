import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  ButtonModule,
  CardComponent,
  FormFieldModule,
  IconModule,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import { InboxLeaseRequestResponse, LeaseDecision } from "@bitwarden/pam";

/**
 * Render a single pending lease request and capture an approve/deny decision.
 *
 * The parent owns the network call; this component emits {@link decide} once
 * per click. Self-approval is disabled at the button level — gating is the
 * parent's responsibility via {@link canDecide}.
 */

@Component({
  selector: "pam-approver-inbox-row",
  templateUrl: "./approver-inbox-row.component.html",
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
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
  readonly request = input.required<InboxLeaseRequestResponse>();
  /**
   * Whether the current user can take a decision on this row.
   * False for self-requests; the buttons render disabled with a tooltip.
   */
  readonly canDecide = input<boolean>(true);
  /** Stable "now" reference for the elapsed-time calculation. */
  readonly now = input<Date>(new Date());

  /** Emitted once per confirmed decision; parent makes the network call. */
  readonly decide = output<{ decision: LeaseDecision; comment: string | undefined }>();

  protected readonly commentControl = new FormControl<string>("", { nonNullable: true });
  protected readonly pendingDecision = signal<LeaseDecision | null>(null);
  protected readonly submitting = signal<boolean>(false);

  protected readonly reasonText = computed(() => this.request().reason?.trim() || null);

  protected readonly elapsedKey = computed(() =>
    elapsedKey(this.request().submittedAt, this.now()),
  );

  protected readonly durationHours = computed(
    () => Math.round((this.request().requestedTtlSeconds / 3600) * 10) / 10,
  );

  protected beginDecision(decision: LeaseDecision): void {
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
    this.decide.emit({ decision, comment: comment.length > 0 ? comment : undefined });
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
