import { BadgeVariant } from "@bitwarden/components";

import type { RotationAttemptId, RotationJobId } from "../rotation";

/** The presentation models the rotation history renders. */

/** A duration split into the units the history renders, or `null` when it cannot be measured. */
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
   * Whether the attempt is still executing.
   *
   * A `null` {@link duration} does not imply it: an attempt abandoned without an end recorded,
   * or one whose timestamps cannot be measured, has no duration either.
   */
  running: boolean;
  statusLabelKey: string;
  /** The attempt's own failure reason, set only when it differs from the job-level cause. */
  divergentFailureReason: string | null;
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
  running: boolean;
  /**
   * When the job's first attempt began, or `null` when no attempt has been recorded.
   *
   * A job waits in the queue before a connector claims it, so {@link createdAt} is when the
   * rotation was asked for rather than when any of it ran. The history states a job's start from
   * here and measures {@link duration} from here, and states neither for a job that has nothing
   * to read a start from.
   */
  startedAt: string | null;
  /** When the job was queued, which is not when it started. See {@link startedAt}. */
  createdAt: string;
  /**
   * The job's total span, or `null` when it cannot be measured.
   *
   * Unmeasurable is not the same as unfinished: a job that timed out before it was ever claimed,
   * or one holding an attempt with no end recorded, is terminal and still has no span. Read
   * {@link running} to tell the two apart.
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
