import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { take } from "rxjs";

import {
  BadgeModule,
  BadgeVariant,
  DialogService,
  DrawerRef,
  TableModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import type { RotationAttempt, RotationConfigId, RotationJob } from "../rotation";
import {
  RotationAttemptStatus,
  RotationJobStatus,
  RotationSource,
  RotationSyncState,
  SessionTerminationOutcome,
} from "../rotation";

import { RotationDurationComponent } from "./rotation-duration.component";
import { RotationJobDrawerComponent } from "./rotation-job-drawer/rotation-job-drawer.component";
import type { AttemptView, DurationParts, JobView } from "./rotation-job-row";

/** Presentational component rendering rotation job history as a table. */
const SOURCE_LABEL_KEYS: Partial<Record<RotationSource, string>> = {
  [RotationSource.Scheduled]: "pamRotationSourceScheduled",
  [RotationSource.OnDemand]: "pamRotationSourceOnDemand",
  [RotationSource.AccessEnd]: "pamRotationSourceAccessEnd",
};

const JOB_STATUS_VARIANTS: Partial<Record<RotationJobStatus, BadgeVariant>> = {
  [RotationJobStatus.Succeeded]: "success",
  [RotationJobStatus.Failed]: "danger",
  [RotationJobStatus.TimedOut]: "danger",
  [RotationJobStatus.Pending]: "secondary",
  [RotationJobStatus.Claimed]: "secondary",
};

const JOB_STATUS_LABEL_KEYS: Partial<Record<RotationJobStatus, string>> = {
  [RotationJobStatus.Pending]: "pamRotationJobStatusPending",
  [RotationJobStatus.Claimed]: "pamRotationJobStatusClaimed",
  [RotationJobStatus.Succeeded]: "pamRotationJobStatusSucceeded",
  [RotationJobStatus.Failed]: "pamRotationJobStatusFailed",
  [RotationJobStatus.TimedOut]: "pamRotationJobStatusTimedOut",
};

const ATTEMPT_STATUS_LABEL_KEYS: Partial<Record<RotationAttemptStatus, string>> = {
  [RotationAttemptStatus.Executing]: "pamRotationAttemptStatusExecuting",
  [RotationAttemptStatus.Rotated]: "pamRotationAttemptStatusRotated",
  [RotationAttemptStatus.Errored]: "pamRotationAttemptStatusErrored",
  [RotationAttemptStatus.Abandoned]: "pamRotationAttemptStatusAbandoned",
};

const SYNC_STATE_LABEL_KEYS: Partial<Record<RotationSyncState, string>> = {
  [RotationSyncState.TargetUnchanged]: "pamRotationSyncStateTargetUnchanged",
  [RotationSyncState.TargetUpdated]: "pamRotationSyncStateTargetUpdated",
  [RotationSyncState.Indeterminate]: "pamRotationSyncStateIndeterminate",
};

const SESSION_TERMINATION_LABEL_KEYS: Partial<Record<SessionTerminationOutcome, string>> = {
  [SessionTerminationOutcome.NotRequested]: "pamRotationSessionTerminationNotRequested",
  [SessionTerminationOutcome.Terminated]: "pamRotationSessionTerminationTerminated",
  [SessionTerminationOutcome.TermFailed]: "pamRotationSessionTerminationTermFailed",
};

@Component({
  selector: "app-rotation-history",
  templateUrl: "./rotation-history.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, BadgeModule, TableModule, I18nPipe, RotationDurationComponent],
})
export class RotationHistoryComponent {
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);

  readonly jobs = input.required<RotationJob[]>();

  /** Whether to name the managed credential each job rotated. */
  readonly showCredential = input(false);

  /** Managed-credential display names by rotation config id, for {@link showCredential}. */
  readonly credentialNames = input<ReadonlyMap<RotationConfigId, string>>(new Map());

  /**
   * Jobs newest-first by the start the Started column shows.
   *
   * A job that never started has none, so it takes its place from `createdAt`, the instant every
   * job has.
   */
  protected readonly jobViews = computed(() =>
    this.jobs()
      .map((job) => this.toJobView(job))
      .sort(
        (a, b) => Date.parse(b.startedAt ?? b.createdAt) - Date.parse(a.startedAt ?? a.createdAt),
      ),
  );

  /** The open details drawer, or null when none is open. */
  private readonly detailsDrawer = signal<DrawerRef<unknown, RotationJobDrawerComponent> | null>(
    null,
  );

  /** Whether the pane is beside the table, which is what drops Source and Duration from it. */
  protected readonly detailsOpen = computed(() => this.detailsDrawer() != null);

  protected openJob(job: JobView, trigger: HTMLElement): void {
    void this.showJob(job, trigger);
  }

  /** Opens one job's details in the side drawer and hands focus back to its row on the way out. */
  private async showJob(job: JobView, trigger: HTMLElement): Promise<void> {
    const drawer = await RotationJobDrawerComponent.open(this.dialogService, {
      closeOnNavigation: true,
      data: { job, showCredential: this.showCredential() },
    });
    if (drawer == null) {
      return;
    }
    drawer.closed.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.detailsDrawer.update((open) => (open === drawer ? null : open));
      trigger.focus();
    });
    this.detailsDrawer.set(drawer);
  }

  protected toJobView(job: RotationJob): JobView {
    const attempts = job.attempts ?? [];
    const finalAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
    const failed =
      job.status === RotationJobStatus.Failed || job.status === RotationJobStatus.TimedOut;
    const running =
      job.status === RotationJobStatus.Pending || job.status === RotationJobStatus.Claimed;

    const reportedReason = finalAttempt?.failureReason ?? null;
    const attemptsUniform =
      finalAttempt !== null &&
      attempts.every(
        (attempt) =>
          attempt.status === finalAttempt.status &&
          (attempt.failureReason ?? null) === reportedReason,
      );

    const credentialName = this.credentialNames().get(job.rotationConfigId);
    const startedAt = this.firstStartedAt(attempts);
    const duration =
      startedAt == null ? null : this.durationParts(startedAt, this.lastEndedAt(attempts));

    return {
      id: job.id,
      credentialName: credentialName ?? String(job.rotationConfigId),
      credentialResolved: credentialName != null,
      sourceLabelKey: this.sourceLabelKey(job.source),
      statusLabelKey: this.jobStatusLabelKey(job.status),
      statusVariant: this.jobStatusVariant(job.status),
      failed,
      running,
      startedAt,
      createdAt: job.createdAt,
      duration,
      attempts: attempts.map((attempt, index) =>
        this.toAttemptView(attempt, index + 1, reportedReason),
      ),
      attemptsUniform: attemptsUniform && attempts.length > 1,
      causeLabelKey: reportedReason ? this.failureCauseLabelKey(reportedReason) : null,
      reportedReason,
      syncStateLabelKey:
        failed && finalAttempt?.syncState != null
          ? this.syncStateLabelKey(finalAttempt.syncState)
          : null,
      syncStateIndeterminate: finalAttempt?.syncState === RotationSyncState.Indeterminate,
      sessionTerminationLabelKey:
        finalAttempt?.sessionTermination != null &&
        finalAttempt.sessionTermination !== SessionTerminationOutcome.NotRequested
          ? this.sessionTerminationLabelKey(finalAttempt.sessionTermination)
          : null,
      sessionTerminationFailed:
        finalAttempt?.sessionTermination === SessionTerminationOutcome.TermFailed,
    };
  }

  private toAttemptView(
    attempt: RotationAttempt,
    ordinal: number,
    jobLevelReason: string | null,
  ): AttemptView {
    const reason = attempt.failureReason ?? null;
    return {
      id: attempt.id,
      ordinal,
      startedAt: attempt.startedAt,
      duration: this.durationParts(attempt.startedAt, attempt.endedAt ?? null),
      running: attempt.status === RotationAttemptStatus.Executing,
      statusLabelKey: this.attemptStatusLabelKey(attempt.status),
      divergentFailureReason: reason !== null && reason !== jobLevelReason ? reason : null,
    };
  }

  /**
   * The earliest start recorded across a job's attempts, or `null` when it has none.
   *
   * A job is queued before a connector claims it, so its own `createdAt` is when the rotation was
   * asked for. What the history states and measures is the work, which begins here.
   *
   * The server returns attempts oldest-first, but the earliest is taken by comparison rather than
   * by position so a reordered page cannot shift a job's start.
   */
  private firstStartedAt(attempts: RotationAttempt[]): string | null {
    if (attempts.length === 0) {
      return null;
    }
    return attempts.reduce((earliest, attempt) =>
      Date.parse(attempt.startedAt) < Date.parse(earliest.startedAt) ? attempt : earliest,
    ).startedAt;
  }

  /** The latest end recorded across a job's attempts, or `null` while any of it is unfinished. */
  private lastEndedAt(attempts: RotationAttempt[]): string | null {
    const ends = attempts.map((attempt) => attempt.endedAt).filter((end) => end != null);
    if (ends.length === 0 || ends.length !== attempts.length) {
      return null;
    }
    return ends.reduce((latest, end) => (Date.parse(end) > Date.parse(latest) ? end : latest));
  }

  /** Whole seconds between two instants, split into hours, minutes and seconds. */
  protected durationParts(fromIso: string, toIso: string | null): DurationParts | null {
    if (toIso == null) {
      return null;
    }
    const elapsed = Date.parse(toIso) - Date.parse(fromIso);
    if (!Number.isFinite(elapsed) || elapsed < 0) {
      return null;
    }
    const totalSeconds = Math.round(elapsed / 1000);
    return {
      hours: Math.floor(totalSeconds / 3600),
      minutes: Math.floor(totalSeconds / 60) % 60,
      seconds: totalSeconds % 60,
    };
  }

  protected sourceLabelKey(source: RotationSource): string {
    return SOURCE_LABEL_KEYS[source] ?? "pamRotationSourceUnknown";
  }

  protected jobStatusVariant(status: RotationJobStatus): BadgeVariant {
    return JOB_STATUS_VARIANTS[status] ?? "subtle";
  }

  protected jobStatusLabelKey(status: RotationJobStatus): string {
    return JOB_STATUS_LABEL_KEYS[status] ?? "pamRotationJobStatusUnknown";
  }

  protected attemptStatusLabelKey(status: RotationAttemptStatus): string {
    return ATTEMPT_STATUS_LABEL_KEYS[status] ?? "pamRotationAttemptStatusUnknown";
  }

  protected syncStateLabelKey(state: RotationSyncState): string {
    return SYNC_STATE_LABEL_KEYS[state] ?? "pamRotationSyncStateUnknown";
  }

  protected sessionTerminationLabelKey(state: SessionTerminationOutcome): string {
    return SESSION_TERMINATION_LABEL_KEYS[state] ?? "pamRotationSessionTerminationUnknown";
  }

  /** The i18n key explaining a failure reason in plain language, or `null` when the reason is not one this screen recognises. */
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
}
