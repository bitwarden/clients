import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { BadgeModule, BadgeVariant, CalloutModule, TableModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  RotationAttemptStatus,
  RotationJobStatus,
  RotationJob,
  RotationSource,
  RotationSyncState,
  SessionTerminationOutcome,
} from "../rotation";

/**
 * Presentational component rendering rotation job and attempt history.
 *
 * Jobs are sorted newest-first (createdAt descending). Each job expands
 * to show its attempts in a nested table.
 */
@Component({
  selector: "app-rotation-history",
  templateUrl: "./rotation-history.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, BadgeModule, CalloutModule, TableModule, I18nPipe],
})
export class RotationHistoryComponent {
  readonly jobs = input.required<RotationJob[]>();

  /** Jobs sorted newest-first by createdAt. */
  protected readonly sortedJobs = computed(() =>
    [...this.jobs()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
  );

  // Expose const objects for template use.
  protected readonly RotationSource = RotationSource;
  protected readonly RotationJobStatus = RotationJobStatus;
  protected readonly RotationAttemptStatus = RotationAttemptStatus;
  protected readonly RotationSyncState = RotationSyncState;
  protected readonly SessionTerminationOutcome = SessionTerminationOutcome;

  protected sourceLabelKey(source: RotationSource): string {
    switch (source) {
      case RotationSource.Scheduled:
        return "pamRotationSourceScheduled";
      case RotationSource.OnDemand:
        return "pamRotationSourceOnDemand";
      case RotationSource.AccessEnd:
        return "pamRotationSourceAccessEnd";
      default:
        return "pamRotationSourceUnknown";
    }
  }

  protected jobStatusVariant(status: RotationJobStatus): BadgeVariant {
    switch (status) {
      case RotationJobStatus.Succeeded:
        return "success";
      case RotationJobStatus.Failed:
      case RotationJobStatus.TimedOut:
        return "danger";
      case RotationJobStatus.Pending:
      case RotationJobStatus.Claimed:
        return "secondary";
      default:
        return "subtle";
    }
  }

  protected jobStatusLabelKey(status: RotationJobStatus): string {
    switch (status) {
      case RotationJobStatus.Pending:
        return "pamRotationJobStatusPending";
      case RotationJobStatus.Claimed:
        return "pamRotationJobStatusClaimed";
      case RotationJobStatus.Succeeded:
        return "pamRotationJobStatusSucceeded";
      case RotationJobStatus.Failed:
        return "pamRotationJobStatusFailed";
      case RotationJobStatus.TimedOut:
        return "pamRotationJobStatusTimedOut";
      default:
        return "pamRotationJobStatusUnknown";
    }
  }

  protected attemptStatusLabelKey(status: RotationAttemptStatus): string {
    switch (status) {
      case RotationAttemptStatus.Executing:
        return "pamRotationAttemptStatusExecuting";
      case RotationAttemptStatus.Rotated:
        return "pamRotationAttemptStatusRotated";
      case RotationAttemptStatus.Errored:
        return "pamRotationAttemptStatusErrored";
      case RotationAttemptStatus.Abandoned:
        return "pamRotationAttemptStatusAbandoned";
      default:
        return "pamRotationAttemptStatusUnknown";
    }
  }

  protected syncStateLabelKey(state: RotationSyncState): string {
    switch (state) {
      case RotationSyncState.TargetUnchanged:
        return "pamRotationSyncStateTargetUnchanged";
      case RotationSyncState.TargetUpdated:
        return "pamRotationSyncStateTargetUpdated";
      case RotationSyncState.Indeterminate:
        return "pamRotationSyncStateIndeterminate";
      default:
        return "pamRotationSyncStateUnknown";
    }
  }

  protected sessionTerminationLabelKey(state: SessionTerminationOutcome): string {
    switch (state) {
      case SessionTerminationOutcome.NotRequested:
        return "pamRotationSessionTerminationNotRequested";
      case SessionTerminationOutcome.Terminated:
        return "pamRotationSessionTerminationTerminated";
      case SessionTerminationOutcome.TermFailed:
        return "pamRotationSessionTerminationTermFailed";
      default:
        return "pamRotationSessionTerminationUnknown";
    }
  }

  /**
   * The i18n key explaining a failure reason in plain language, or `null` when the reason is not
   * one this screen recognises.
   *
   * The reason is `<connector token>` or `<connector token>: <detail>`, composed server-side by
   * ReportRotationFailedRequestModel.ToFailureReason. Matching is deliberately narrow: an
   * explanation that is wrong about why an access change failed is worse than no explanation, so
   * anything unrecognised falls back to the raw string the attempt recorded.
   */
  protected failureCauseLabelKey(failureReason: string): string | null {
    const ldapResultCode = /\bLDAP\s+(?:result\s+|error\s+)?code\s+(\d{1,3})\b/i.exec(
      failureReason,
    )?.[1];
    switch (ldapResultCode) {
      case "19":
        return "pamRotationFailureCausePasswordRejected";
      case "32":
        return "pamRotationFailureCauseAccountNotFound";
      case "49":
        return "pamRotationFailureCauseInvalidCredentials";
      case "50":
        return "pamRotationFailureCauseInsufficientRights";
      case "53":
        return "pamRotationFailureCauseDirectoryRefused";
    }

    const [errorCode] = failureReason.split(":", 1);
    if (errorCode.trim().toLowerCase() === "target_unreachable") {
      return "pamRotationFailureCauseTargetUnreachable";
    }

    return null;
  }

  /**
   * The one plain-cause key that explains a whole job, or `null` when the job's attempts do not
   * agree on one.
   *
   * `failureReason` is per-attempt and `RotationJob` has no failure field, so a job-level cause is a
   * derivation, not data. It is only safe to state once when every attempt this screen *recognises*
   * resolves to the same key: a job whose first attempt could not reach the target and whose retry
   * the directory refused failed two ways, and claiming one cause for it would misdescribe why an
   * access change failed. Attempts whose reason is unrecognised are skipped rather than
   * disqualifying - they keep their own raw reason on their own row.
   *
   * A job that is still running, or that retried and succeeded, carries errored attempts too, so
   * the job's own status gates the derivation: only a job that finished failed has a cause to
   * state.
   */
  protected jobFailureCauseLabelKey(job: RotationJob): string | null {
    if (job.status !== RotationJobStatus.Failed && job.status !== RotationJobStatus.TimedOut) {
      return null;
    }

    let shared: string | null = null;

    for (const attempt of job.attempts) {
      const key = attempt.failureReason ? this.failureCauseLabelKey(attempt.failureReason) : null;
      if (key === null) {
        continue;
      }
      if (shared !== null && shared !== key) {
        return null;
      }
      shared = key;
    }

    return shared;
  }
}
