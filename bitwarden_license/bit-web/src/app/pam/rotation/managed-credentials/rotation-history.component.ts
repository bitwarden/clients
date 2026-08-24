import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { BadgeModule, BadgeVariant, TableModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { RotationJobResponse } from "../responses/rotation-config-details.response";
import {
  RotationAttemptStatus,
  RotationJobStatus,
  RotationSessionTermination,
  RotationSource,
  RotationSyncState,
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
  imports: [CommonModule, BadgeModule, TableModule, I18nPipe],
})
export class RotationHistoryComponent {
  readonly jobs = input.required<RotationJobResponse[]>();

  /** Jobs sorted newest-first by createdAt. */
  protected readonly sortedJobs = computed(() =>
    [...this.jobs()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
  );

  // Expose const objects for template use.
  protected readonly RotationSource = RotationSource;
  protected readonly RotationJobStatus = RotationJobStatus;
  protected readonly RotationAttemptStatus = RotationAttemptStatus;
  protected readonly RotationSyncState = RotationSyncState;
  protected readonly RotationSessionTermination = RotationSessionTermination;

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

  protected sessionTerminationLabelKey(state: RotationSessionTermination): string {
    switch (state) {
      case RotationSessionTermination.NotRequested:
        return "pamRotationSessionTerminationNotRequested";
      case RotationSessionTermination.Terminated:
        return "pamRotationSessionTerminationTerminated";
      case RotationSessionTermination.TermFailed:
        return "pamRotationSessionTerminationTermFailed";
      default:
        return "pamRotationSessionTerminationUnknown";
    }
  }
}
