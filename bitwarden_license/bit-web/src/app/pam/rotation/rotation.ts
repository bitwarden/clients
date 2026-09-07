/**
 * The rotation domain, re-exported from the Rust SDK.
 *
 * Every type here is the SDK's; this file exists so the module keeps one import path and so the
 * enum *values* stay ergonomic — the SDK models each as a string union, so each gets a frozen
 * const object alongside its type (`TargetSystemMethod.Automatic` reads the same, though the
 * wire value is now `"automatic"`, not a tinyint).
 *
 * Note the vocabulary shift: what this module called a *rotation daemon* the server calls an
 * *access connector*; the standalone agent consuming a registration token is still the rotation
 * daemon.
 */
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
 * How a target system's credential is rotated: `Automatic` (a connector writes the new secret),
 * `Manual` (an operator applies it out of band and records having done so), or `Unknown` (a
 * method a newer server named that this SDK can't model — treated as inert).
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

/** Lifecycle state of a target system. `Disabled` stops new jobs; in-flight jobs finish. */
export const TargetSystemStatus = Object.freeze({
  Active: "active",
  Disabled: "disabled",
  Unknown: "unknown",
} as const satisfies Record<string, SdkTargetSystemStatus>);
export type TargetSystemStatus = SdkTargetSystemStatus;

/**
 * Lifecycle state of an access connector.
 *
 * `Disabled` is reversible. Deleting a connector invalidates its credential, but rotating the
 * organization key remains the remediation for suspected compromise, since it held that key in
 * plaintext.
 */
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

/** Overall status of a rotation job. */
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
 * Whether the target system ended up holding the rotated credential.
 *
 * `Indeterminate` is the one to handle deliberately: the target-system call may or may not have
 * applied, and no vault write was attempted, so the two can disagree until the next rotation.
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
 * A named rotation schedule.
 *
 * Presentation only — the server stores just the cron string, so `Custom` means "a valid
 * expression that matches no preset" and round-trips unchanged.
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

/**
 * The UI's name for {@link AccessConnectorStatus}.
 *
 * The server and the SDK say *access connector*; this admin surface says *daemon*, as does every
 * `pamDaemon*` i18n key and the standalone agent that consumes a registration token. Aliasing
 * rather than renaming keeps that user-facing vocabulary intact without introducing a second type.
 */
export const DaemonStatus = AccessConnectorStatus;
export type DaemonStatus = AccessConnectorStatus;
