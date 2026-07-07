import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import type {
  RotationAttemptStatus,
  RotationJobStatus,
  RotationSessionTermination,
  RotationSource,
  RotationSyncState,
} from "../rotation";

import { RotationConfigResponse } from "./rotation-config.response";

/**
 * One rotation attempt within a job — a single daemon's execution of the rotation sequence.
 *
 * NOTE: These fields reflect the **planned** server contract (server not yet implemented).
 * Status, syncState, and sessionTermination are numeric tinyints matching the const-object
 * values in `../rotation`. Timestamps are ISO-8601 strings. Wire property names are PascalCase.
 */
export class RotationAttemptResponse extends BaseResponse {
  /** The attempt's stable identifier (UUID). */
  id: string;
  /**
   * Current execution state of this attempt.
   * 0 = Executing; 1 = Rotated; 2 = Errored; 3 = Abandoned.
   */
  status: RotationAttemptStatus;
  /**
   * Human-readable failure reason, populated when status is Errored or Abandoned.
   * May be null when the daemon did not supply a reason.
   */
  failureReason: string | null;
  /**
   * Whether the target system's credential was updated to match the rotated value.
   * 0 = TargetUnchanged; 1 = TargetUpdated; 2 = Indeterminate.
   * Null until the attempt completes.
   */
  syncState: RotationSyncState | null;
  /**
   * Whether session termination was attempted after rotation.
   * 0 = NotRequested; 1 = Terminated; 2 = TermFailed.
   * Null when terminateSessions is false or the attempt has not yet completed.
   */
  sessionTermination: RotationSessionTermination | null;
  /** ISO-8601 timestamp when the daemon started executing this attempt. */
  startedAt: string;
  /** ISO-8601 timestamp when the attempt completed, or null if still executing. */
  endedAt: string | null;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.status = this.getResponseProperty("Status");
    this.failureReason = this.getResponseProperty("FailureReason") ?? null;
    this.syncState = this.getResponseProperty("SyncState") ?? null;
    this.sessionTermination = this.getResponseProperty("SessionTermination") ?? null;
    this.startedAt = this.getResponseProperty("StartedAt");
    this.endedAt = this.getResponseProperty("EndedAt") ?? null;
  }
}

/**
 * One rotation job within a config's history — a single dispatch of the rotation workflow.
 * Each job may have multiple attempts (e.g. retries or multiple assigned daemons racing).
 *
 * NOTE: These fields reflect the **planned** server contract (server not yet implemented).
 * `source` and `status` are numeric tinyints matching the const-object values in `../rotation`.
 * Wire property names are PascalCase.
 */
export class RotationJobResponse extends BaseResponse {
  /** The job's stable identifier (UUID). */
  id: string;
  /**
   * What triggered this rotation job.
   * 0 = Scheduled; 1 = OnDemand; 2 = AccessEnd.
   */
  source: RotationSource;
  /**
   * Current lifecycle state of the job.
   * 0 = Pending; 1 = Claimed; 2 = Succeeded; 3 = Failed; 4 = TimedOut.
   */
  status: RotationJobStatus;
  /** ISO-8601 timestamp when the job was created (dispatched to the queue). */
  createdAt: string;
  /**
   * Ordered list of rotation attempts for this job, oldest first.
   * Parsed as nested {@link RotationAttemptResponse} instances.
   */
  attempts: RotationAttemptResponse[];

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.source = this.getResponseProperty("Source");
    this.status = this.getResponseProperty("Status");
    this.createdAt = this.getResponseProperty("CreatedAt");
    this.attempts = ((this.getResponseProperty("Attempts") as unknown[]) ?? []).map(
      (a) => new RotationAttemptResponse(a),
    );
  }
}

/**
 * Detailed view from GET /organizations/{orgId}/rotation/configs/{id} — extends the list
 * item with the full job and attempt history for the config.
 *
 * NOTE: These fields reflect the **planned** server contract (server not yet implemented).
 * `jobs` is an ordered list (newest first, matching typical UI conventions) of
 * {@link RotationJobResponse} instances parsed as nested BaseResponses. Wire property
 * names are PascalCase.
 */
export class RotationConfigDetailsResponse extends RotationConfigResponse {
  /**
   * Rotation job history for this config, newest first.
   * Each job carries its own attempt list (oldest first within the job).
   */
  jobs: RotationJobResponse[];

  constructor(response: unknown) {
    super(response);
    this.jobs = ((this.getResponseProperty("Jobs") as unknown[]) ?? []).map(
      (j) => new RotationJobResponse(j),
    );
  }
}
