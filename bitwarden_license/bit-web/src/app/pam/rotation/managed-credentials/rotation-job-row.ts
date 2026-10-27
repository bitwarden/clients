import { BadgeVariant } from "@bitwarden/components";

import type { RotationAttemptId, RotationJobId } from "../rotation";

/** The presentation models the rotation history renders. */

/** A duration split into the units the history renders. */
export interface DurationParts {
  hours: number;
  minutes: number;
  seconds: number;
}

/** One attempt, reduced to what the drawer's attempt table shows. */
export interface AttemptView {
  id: RotationAttemptId;
  ordinal: number;
  startedAt: string;
  duration: DurationParts | null;
  /**
   * Whether the attempt is still executing. A `null` {@link duration} doesn't imply it, since an
   * abandoned or unmeasurable attempt has none either.
   */
  running: boolean;
  statusLabelKey: string;
  /** The attempt's result as the design words it: Succeeded, Failed or In progress. */
  resultLabelKey: string;
  failed: boolean;
  /** The Access connector the attempt ran on, or `null` when none claimed it. */
  connectorName: string | null;
  /** A plain explanation of why the attempt failed, or `null` when none is recognised. */
  causeLabelKey: string | null;
  /** The reason string the connector reported, shown verbatim. */
  failureReason: string | null;
}

/** What the drawer says about session termination for the job's target system. */
export interface EndingSessionsInfo {
  kind: string;
  supported: boolean;
}

/** One job, as the history presents it: an outcome, a cause, and its attempts. */
export interface JobView {
  id: RotationJobId;
  /** The managed credential this job rotated, or the config id when no name resolved. */
  credentialName: string;
  /** False when {@link credentialName} is the raw config id rather than a resolved name. */
  credentialResolved: boolean;
  sourceLabelKey: string;
  statusLabelKey: string;
  statusVariant: BadgeVariant;
  failed: boolean;
  /** True for a job that succeeded only after an earlier attempt failed. */
  retrySucceeded: boolean;
  /**
   * Whether a connector has claimed the job and is executing it. A queued job is not running and
   * may never be claimed.
   */
  running: boolean;
  /**
   * When the first attempt began, or `null` with no attempt recorded. The history states the start
   * and measures {@link duration} from here, not from {@link createdAt}, which is when it queued.
   */
  startedAt: string | null;
  /** When the job was queued, not when it started. */
  createdAt: string;
  /** {@link startedAt}, or {@link createdAt} for a job that never started. */
  displayStartedAt: string;
  /**
   * The job's total span, or `null` when unmeasurable. A terminal job can have none, such as one
   * that timed out unclaimed, so read {@link running} to tell it from an unfinished one.
   */
  duration: DurationParts | null;
  attempts: AttemptView[];
  /** True when every attempt shares the outcome and reason of the final one. */
  attemptsUniform: boolean;
  /** The recognised explanation for the failure, or `null` when the reason is unrecognised. */
  causeLabelKey: string | null;
  /** The reason string the connector reported, shown verbatim once per job. */
  reportedReason: string | null;
  syncStateLabelKey: string | null;
  syncStateIndeterminate: boolean;
  sessionTerminationLabelKey: string | null;
  sessionTerminationFailed: boolean;
}
