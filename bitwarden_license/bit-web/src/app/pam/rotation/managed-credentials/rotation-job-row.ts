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
  createdAt: string;
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
