/** The rotation domain, re-exported from the Rust SDK. */
import type {
  AccessConnectorStatus as SdkAccessConnectorStatus,
  QuartzSchedulePreset as SdkQuartzSchedulePreset,
  RotationAttemptStatus as SdkRotationAttemptStatus,
  RotationJobStatus as SdkRotationJobStatus,
  RotationSource as SdkRotationSource,
  RotationSyncState as SdkRotationSyncState,
  SessionTerminationOutcome as SdkSessionTerminationOutcome,
  TargetSystemKind as SdkTargetSystemKind,
  TargetSystemMethod as SdkTargetSystemMethod,
  TargetSystemStatus as SdkTargetSystemStatus,
} from "@bitwarden/sdk-internal";

export type {
  AccessConnector,
  AccessConnectorDetail,
  AccessConnectorId,
  AccessConnectorRegistrationResponse,
  PasswordPolicy,
  RotationAttempt,
  RotationAttemptId,
  RotationConfig,
  RotationConfigActions,
  RotationConfigCreateRequest,
  RotationConfigDetail,
  RotationConfigId,
  RotationConfigUpdateRequest,
  RotationJob,
  RotationJobId,
  TargetSystem,
  TargetSystemCreateRequest,
  TargetSystemId,
  TargetSystemUpdateRequest,
} from "@bitwarden/sdk-internal";

/**
 * How a target system's credential is rotated. `Manual` means an operator applies it out of band
 * and records it; `Unknown` is a method from a newer server, treated as inert.
 */
export const TargetSystemMethod = Object.freeze({
  Automatic: "automatic",
  Manual: "manual",
  Unknown: "unknown",
} as const satisfies Record<string, SdkTargetSystemMethod>);
export type TargetSystemMethod = SdkTargetSystemMethod;

/** The integration behind an automatic target system. A manual one has none. */
export const TargetSystemKind = Object.freeze({
  Entra: "entra",
  Mssql: "mssql",
  CustomScript: "custom_script",
  Unknown: "unknown",
} as const satisfies Record<string, SdkTargetSystemKind>);
export type TargetSystemKind = SdkTargetSystemKind;

/** `Disabled` stops new jobs; in-flight jobs finish. */
export const TargetSystemStatus = Object.freeze({
  Active: "active",
  Disabled: "disabled",
  Unknown: "unknown",
} as const satisfies Record<string, SdkTargetSystemStatus>);
export type TargetSystemStatus = SdkTargetSystemStatus;

/** `Disabled` is reversible. */
export const AccessConnectorStatus = Object.freeze({
  Enabled: "enabled",
  Disabled: "disabled",
  Unknown: "unknown",
} as const satisfies Record<string, SdkAccessConnectorStatus>);
export type AccessConnectorStatus = SdkAccessConnectorStatus;

/** What triggered a rotation job. */
export const RotationSource = Object.freeze({
  Scheduled: "scheduled",
  OnDemand: "on_demand",
  AccessEnd: "access_end",
  Unknown: "unknown",
} as const satisfies Record<string, SdkRotationSource>);
export type RotationSource = SdkRotationSource;

export const RotationJobStatus = Object.freeze({
  Pending: "pending",
  Claimed: "claimed",
  Succeeded: "succeeded",
  Failed: "failed",
  TimedOut: "timed_out",
  Unknown: "unknown",
} as const satisfies Record<string, SdkRotationJobStatus>);
export type RotationJobStatus = SdkRotationJobStatus;

/** Per-attempt outcome within a rotation job. */
export const RotationAttemptStatus = Object.freeze({
  Executing: "executing",
  Rotated: "rotated",
  Errored: "errored",
  Abandoned: "abandoned",
  Unknown: "unknown",
} as const satisfies Record<string, SdkRotationAttemptStatus>);
export type RotationAttemptStatus = SdkRotationAttemptStatus;

/**
 * Whether the target system ended up holding the rotated credential. `Indeterminate` means the
 * target call may have applied without a vault write, so the two can disagree until the next
 * rotation.
 */
export const RotationSyncState = Object.freeze({
  TargetUnchanged: "target_unchanged",
  TargetUpdated: "target_updated",
  Indeterminate: "indeterminate",
  Unknown: "unknown",
} as const satisfies Record<string, SdkRotationSyncState>);
export type RotationSyncState = SdkRotationSyncState;

/** Whether the connector terminated the account's sessions after rotating. */
export const SessionTerminationOutcome = Object.freeze({
  NotRequested: "not_requested",
  Terminated: "terminated",
  TermFailed: "term_failed",
  Unknown: "unknown",
} as const satisfies Record<string, SdkSessionTerminationOutcome>);
export type SessionTerminationOutcome = SdkSessionTerminationOutcome;

/**
 * A named rotation schedule, presentation only. The server stores only the cron string, so
 * `Custom` is a valid expression matching no preset and round-trips unchanged.
 */
export const QuartzSchedulePreset = Object.freeze({
  None: "none",
  Hourly: "hourly",
  Every6Hours: "every6_hours",
  Daily: "daily",
  Weekly: "weekly",
  Monthly: "monthly",
  Custom: "custom",
} as const satisfies Record<string, SdkQuartzSchedulePreset>);
export type QuartzSchedulePreset = SdkQuartzSchedulePreset;
