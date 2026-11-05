import { importProvidersFrom } from "@angular/core";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { DIALOG_DATA } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { attemptId, configId, jobId } from "../../testing/rotation-builders";
import { AttemptView, JobView } from "../rotation-job-row";

import {
  RotationJobDrawerComponent,
  RotationJobDrawerParams,
} from "./rotation-job-drawer.component";

const STARTED_AT = "2026-08-18T09:00:00.000Z";

const ROTATED_ATTEMPT: AttemptView = {
  id: attemptId("1"),
  ordinal: 1,
  startedAt: STARTED_AT,
  duration: { hours: 0, minutes: 0, seconds: 42 },
  running: false,
  statusLabelKey: "pamRotationAttemptStatusRotated",
  divergentFailureReason: null,
};

/** A scheduled rotation that succeeded on its first attempt. */
const SUCCEEDED: JobView = {
  id: jobId("j1"),
  credentialName: "Production database credential",
  credentialResolved: true,
  sourceLabelKey: "pamRotationSourceScheduled",
  statusLabelKey: "pamRotationJobStatusSucceeded",
  statusVariant: "success",
  failed: false,
  running: false,
  startedAt: STARTED_AT,
  createdAt: STARTED_AT,
  duration: { hours: 0, minutes: 0, seconds: 42 },
  attempts: [ROTATED_ATTEMPT],
  attemptsUniform: false,
  causeLabelKey: null,
  reportedReason: null,
  syncStateLabelKey: null,
  syncStateIndeterminate: false,
  sessionTerminationLabelKey: null,
  sessionTerminationFailed: false,
};

const LDAP_INVALID_CREDENTIALS = "ldap_bind: LDAP result code 49 (invalidCredentials)";

/** Three attempts, the second of which failed for a different reason than the final one. */
const FAILED: JobView = {
  ...SUCCEEDED,
  id: jobId("j2"),
  sourceLabelKey: "pamRotationSourceOnDemand",
  statusLabelKey: "pamRotationJobStatusFailed",
  statusVariant: "danger",
  failed: true,
  duration: { hours: 0, minutes: 6, seconds: 15 },
  attempts: [
    {
      ...ROTATED_ATTEMPT,
      id: attemptId("1"),
      statusLabelKey: "pamRotationAttemptStatusErrored",
    },
    {
      ...ROTATED_ATTEMPT,
      id: attemptId("2"),
      ordinal: 2,
      startedAt: "2026-08-18T09:02:00.000Z",
      duration: { hours: 0, minutes: 1, seconds: 3 },
      statusLabelKey: "pamRotationAttemptStatusErrored",
      divergentFailureReason: "target_unreachable: dial tcp 10.0.4.12:636: i/o timeout",
    },
    {
      ...ROTATED_ATTEMPT,
      id: attemptId("3"),
      ordinal: 3,
      startedAt: "2026-08-18T09:06:00.000Z",
      duration: { hours: 0, minutes: 0, seconds: 15 },
      statusLabelKey: "pamRotationAttemptStatusErrored",
    },
  ],
  causeLabelKey: "pamRotationFailureCauseInvalidCredentials",
  reportedReason: LDAP_INVALID_CREDENTIALS,
  syncStateLabelKey: "pamRotationSyncStateTargetUnchanged",
};

/** Every attempt failed alike, with a reason no cause is recognised for. */
const FAILED_UNIFORM: JobView = {
  ...FAILED,
  id: jobId("j3"),
  attempts: FAILED.attempts.map((attempt): AttemptView => ({
    ...attempt,
    divergentFailureReason: null,
  })),
  attemptsUniform: true,
  causeLabelKey: null,
  reportedReason: "connector_panic: unexpected EOF reading sealed payload",
  syncStateLabelKey: null,
};

/** The target may hold the new password while the vault still holds the old one. */
const SYNC_INDETERMINATE: JobView = {
  ...FAILED,
  id: jobId("j4"),
  syncStateLabelKey: "pamRotationSyncStateIndeterminate",
  syncStateIndeterminate: true,
};

/** A connector has claimed the job and its first attempt is still executing. */
const IN_PROGRESS: JobView = {
  ...SUCCEEDED,
  id: jobId("j5"),
  statusLabelKey: "pamRotationJobStatusClaimed",
  statusVariant: "secondary",
  running: true,
  duration: null,
  attempts: [
    {
      ...ROTATED_ATTEMPT,
      duration: null,
      running: true,
      statusLabelKey: "pamRotationAttemptStatusExecuting",
    },
  ],
};

/** Queued with no attempt yet, so there's no start, duration or attempt table. */
const QUEUED: JobView = {
  ...SUCCEEDED,
  id: jobId("j6"),
  statusLabelKey: "pamRotationJobStatusPending",
  statusVariant: "secondary",
  startedAt: null,
  duration: null,
  attempts: [],
};

/** Expired before any connector claimed it, so it failed with nothing to explain. */
const TIMED_OUT: JobView = {
  ...QUEUED,
  id: jobId("j7"),
  statusLabelKey: "pamRotationJobStatusTimedOut",
  statusVariant: "danger",
  failed: true,
};

/** Rotated when a lease ended, closing the holder's open sessions. */
const ACCESS_END: JobView = {
  ...SUCCEEDED,
  id: jobId("j8"),
  sourceLabelKey: "pamRotationSourceAccessEnd",
  sessionTerminationLabelKey: "pamRotationSessionTerminationTerminated",
};

const SESSION_TERMINATION_FAILED: JobView = {
  ...ACCESS_END,
  id: jobId("j9"),
  sessionTerminationLabelKey: "pamRotationSessionTerminationTermFailed",
  sessionTerminationFailed: true,
};

/** No name resolved for the config, so the drawer falls back to its id. */
const UNRESOLVED_CREDENTIAL: JobView = {
  ...SUCCEEDED,
  id: jobId("j10"),
  credentialName: String(configId("c1")),
  credentialResolved: false,
};

/** A reason with no break opportunity wraps, since the dialog's size fixes the width. */
const LONG_REASON: JobView = {
  ...FAILED_UNIFORM,
  id: jobId("j11"),
  reportedReason: "Xk9Qw2Zr7Lm4Vb8Ns3Ty6Hj1Pd5Gf0Cx".repeat(13),
};

/** Provided per story, since the drawer reads `DIALOG_DATA` once at construction. */
function withParams(job: JobView, showCredential = true) {
  const params: RotationJobDrawerParams = { job, showCredential };
  return moduleMetadata({
    imports: [RotationJobDrawerComponent],
    providers: [{ provide: DIALOG_DATA, useValue: params }],
  });
}

export default {
  title: "Web/PAM/Rotation/Job Drawer",
  component: RotationJobDrawerComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule), provideNoopAnimations()],
    }),
  ],
  render: () => ({ template: `<pam-rotation-job-drawer />` }),
} as Meta<RotationJobDrawerComponent>;

type Story = StoryObj<RotationJobDrawerComponent>;

export const Succeeded: Story = { decorators: [withParams(SUCCEEDED)] };

/** On a config's own history the credential is implied, so the drawer omits it. */
export const WithoutCredential: Story = { decorators: [withParams(SUCCEEDED, false)] };

export const UnresolvedCredential: Story = { decorators: [withParams(UNRESOLVED_CREDENTIAL)] };

/** A recognised cause, the raw reason beneath it, and one attempt that failed differently. */
export const Failed: Story = { decorators: [withParams(FAILED)] };

export const FailedUniformly: Story = { decorators: [withParams(FAILED_UNIFORM)] };

export const SyncIndeterminate: Story = { decorators: [withParams(SYNC_INDETERMINATE)] };

export const InProgress: Story = { decorators: [withParams(IN_PROGRESS)] };

export const Queued: Story = { decorators: [withParams(QUEUED)] };

export const TimedOutUnclaimed: Story = { decorators: [withParams(TIMED_OUT)] };

export const AccessEnd: Story = { decorators: [withParams(ACCESS_END)] };

export const SessionTerminationFailed: Story = {
  decorators: [withParams(SESSION_TERMINATION_FAILED)],
};

export const LongUnbrokenReason: Story = { decorators: [withParams(LONG_REASON)] };
