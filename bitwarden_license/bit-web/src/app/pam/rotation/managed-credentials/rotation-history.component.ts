import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  LOCALE_ID,
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
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableV2Component,
  DialogService,
  DrawerRef,
  LinkModule,
  TableModule,
  defineTable,
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
import { formatRotationTimestamp } from "../rotation-timestamp";

import { RotationDurationComponent } from "./rotation-duration.component";
import { RotationJobDrawerComponent } from "./rotation-job-drawer/rotation-job-drawer.component";
import type { AttemptView, DurationParts, EndingSessionsInfo, JobView } from "./rotation-job-row";

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
  imports: [
    CommonModule,
    BadgeModule,
    BitCellComponent,
    BitCellDefDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTableV2Component,
    LinkModule,
    TableModule,
    I18nPipe,
    RotationDurationComponent,
  ],
})
export class RotationHistoryComponent {
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);

  readonly jobs = input.required<RotationJob[]>();

  /** Whether to name the managed credential each job rotated. */
  readonly showCredential = input(false);

  /** Managed-credential display names by rotation config id, for {@link showCredential}. */
  readonly credentialNames = input<ReadonlyMap<RotationConfigId, string>>(new Map());

  /** Access connector names by id, for the drawer's attempts. */
  readonly connectorNames = input<ReadonlyMap<string, string>>(new Map());

  /** What the drawer says about session termination, or `null` to leave the field out. */
  readonly endingSessions = input<EndingSessionsInfo | null>(null);

  /** Newest first by start time, falling back to `createdAt` for a job that never started. */
  protected readonly jobViews = computed(() =>
    this.jobs()
      .map((job) => this.toJobView(job))
      .sort(
        (a, b) => Date.parse(b.startedAt ?? b.createdAt) - Date.parse(a.startedAt ?? a.createdAt),
      ),
  );

  private readonly detailsDrawer = signal<DrawerRef<unknown, RotationJobDrawerComponent> | null>(
    null,
  );

  /** Whether the pane is beside the table, which is what drops Source and Duration from it. */
  protected readonly detailsOpen = computed(() => this.detailsDrawer() != null);

  protected readonly table = defineTable<JobView>(this.jobViews);

  protected formatTimestamp(iso: string): string {
    return formatRotationTimestamp(iso, this.locale);
  }

  /** Guards {@link showJob}'s focus restore against a still-pending, since-superseded open. */
  private readonly openSeq = signal(0);

  protected openJob(job: JobView, trigger: HTMLElement): void {
    void this.showJob(job, trigger);
  }

  /** Returns focus to the row's trigger when the drawer closes. */
  private async showJob(job: JobView, trigger: HTMLElement): Promise<void> {
    const seq = this.openSeq() + 1;
    this.openSeq.set(seq);
    const drawer = await RotationJobDrawerComponent.open(this.dialogService, {
      closeOnNavigation: true,
      data: {
        job,
        showCredential: this.showCredential(),
        endingSessions: this.endingSessions(),
      },
    });
    if (drawer == null) {
      return;
    }
    drawer.closed.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.detailsDrawer.update((open) => (open === drawer ? null : open));
      if (this.openSeq() === seq) {
        trigger.focus();
      }
    });
    this.detailsDrawer.set(drawer);
  }

  protected toJobView(job: RotationJob): JobView {
    /**
     * The server doesn't guarantee attempt order, so every job-level fact and ordinal below derives
     * from this one sort.
     */
    const attempts = [...(job.attempts ?? [])].sort(
      (a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt),
    );
    const finalAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
    const failed =
      job.status === RotationJobStatus.Failed || job.status === RotationJobStatus.TimedOut;
    const running = job.status === RotationJobStatus.Claimed;

    const reportedReason = finalAttempt?.failureReason ?? null;
    const attemptsUniform =
      finalAttempt !== null &&
      attempts.every(
        (attempt) =>
          attempt.status === finalAttempt.status &&
          (attempt.failureReason ?? null) === reportedReason,
      );

    const credentialName = this.credentialNames().get(job.rotationConfigId);
    const startedAt = attempts.length > 0 ? attempts[0].startedAt : null;
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
      retrySucceeded: job.status === RotationJobStatus.Succeeded && attempts.length > 1,
      running,
      startedAt,
      createdAt: job.createdAt,
      displayStartedAt: startedAt ?? job.createdAt,
      duration,
      attempts: attempts.map((attempt, index) =>
        this.toAttemptView(attempt, index + 1, job.status === RotationJobStatus.TimedOut),
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
    jobTimedOut: boolean,
  ): AttemptView {
    const reason = attempt.failureReason ?? null;
    const failed =
      attempt.status === RotationAttemptStatus.Errored ||
      attempt.status === RotationAttemptStatus.Abandoned;
    const connectorId = attempt.claimedByAccessConnectorId;
    return {
      id: attempt.id,
      ordinal,
      startedAt: attempt.startedAt,
      duration: this.durationParts(attempt.startedAt, attempt.endedAt ?? null),
      running: attempt.status === RotationAttemptStatus.Executing,
      statusLabelKey: this.attemptStatusLabelKey(attempt.status),
      resultLabelKey: this.attemptResultLabelKey(attempt.status),
      failed,
      connectorName:
        connectorId == null ? null : (this.connectorNames().get(String(connectorId)) ?? null),
      causeLabelKey: failed ? this.attemptCauseLabelKey(reason, jobTimedOut) : null,
      failureReason: reason,
    };
  }

  private attemptResultLabelKey(status: RotationAttemptStatus): string {
    switch (status) {
      case RotationAttemptStatus.Rotated:
        return "pamRotationAttemptResultSucceeded";
      case RotationAttemptStatus.Errored:
      case RotationAttemptStatus.Abandoned:
        return "pamRotationAttemptResultFailed";
      default:
        return this.attemptStatusLabelKey(status);
    }
  }

  private attemptCauseLabelKey(reason: string | null, jobTimedOut: boolean): string | null {
    const unreachable = reason?.split(":", 1)[0].trim().toLowerCase() === "target_unreachable";
    if (unreachable || jobTimedOut) {
      return "pamRotationAttemptCauseTargetUnreachable";
    }
    return reason ? this.failureCauseLabelKey(reason) : null;
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

  /** A plain-language i18n key for a recognised failure reason, else `null`. */
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
