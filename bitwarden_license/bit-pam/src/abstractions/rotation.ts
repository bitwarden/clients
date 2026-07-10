/**
 * How a target system's credential is rotated. Mirrors the server's tinyint `Method` on `PamTargetSystem`.
 * Allium spec: TargetSystemMethod.
 *
 * - `Automatic` (0) — the daemon writes the new secret directly into the target system.
 * - `Manual` (1)    — the operator applies the new credential out-of-band; the config records the event.
 */
export const TargetSystemMethod = Object.freeze({
  Automatic: 0,
  Manual: 1,
} as const);
export type TargetSystemMethod = (typeof TargetSystemMethod)[keyof typeof TargetSystemMethod];

export function isTargetSystemMethod(value: unknown): value is TargetSystemMethod {
  return Object.values(TargetSystemMethod).includes(value as TargetSystemMethod);
}

export function toTargetSystemMethod(value: unknown): TargetSystemMethod | undefined {
  if (isTargetSystemMethod(value)) {
    return value;
  }
  if (typeof value === "string") {
    const asInt = parseInt(value, 10);
    if (isTargetSystemMethod(asInt)) {
      return asInt;
    }
  }
  return undefined;
}

/**
 * The technology a target system represents. Mirrors the server's tinyint `Kind` on `PamTargetSystem`.
 * Allium spec: TargetSystemKind. Only set when `TargetSystemMethod` is `Automatic`.
 *
 * - `Entra` (0)        — Entra ID / Azure AD service-account password rotation.
 * - `Mssql` (1)        — SQL Server login password rotation.
 * - `CustomScript` (2) — operator-supplied script run by the daemon.
 */
export const TargetSystemKind = Object.freeze({
  Entra: 0,
  Mssql: 1,
  CustomScript: 2,
} as const);
export type TargetSystemKind = (typeof TargetSystemKind)[keyof typeof TargetSystemKind];

export function isTargetSystemKind(value: unknown): value is TargetSystemKind {
  return Object.values(TargetSystemKind).includes(value as TargetSystemKind);
}

export function toTargetSystemKind(value: unknown): TargetSystemKind | undefined {
  if (isTargetSystemKind(value)) {
    return value;
  }
  if (typeof value === "string") {
    const asInt = parseInt(value, 10);
    if (isTargetSystemKind(asInt)) {
      return asInt;
    }
  }
  return undefined;
}

/**
 * Lifecycle state of a target system. Mirrors the server's tinyint `Status` on `PamTargetSystem`.
 * Allium spec: TargetSystemStatus.
 *
 * - `Active` (0)   — the target system accepts rotation jobs.
 * - `Disabled` (1) — no new rotation jobs are dispatched; existing jobs run to completion.
 */
export const TargetSystemStatus = Object.freeze({
  Active: 0,
  Disabled: 1,
} as const);
export type TargetSystemStatus = (typeof TargetSystemStatus)[keyof typeof TargetSystemStatus];

export function isTargetSystemStatus(value: unknown): value is TargetSystemStatus {
  return Object.values(TargetSystemStatus).includes(value as TargetSystemStatus);
}

export function toTargetSystemStatus(value: unknown): TargetSystemStatus | undefined {
  if (isTargetSystemStatus(value)) {
    return value;
  }
  if (typeof value === "string") {
    const asInt = parseInt(value, 10);
    if (isTargetSystemStatus(asInt)) {
      return asInt;
    }
  }
  return undefined;
}

/**
 * Lifecycle state of a rotation daemon. Mirrors the server's tinyint `Status` on `PamRotationDaemon`.
 * Allium spec: DaemonStatus.
 *
 * - `Enabled` (0)  — the daemon may claim rotation jobs.
 * - `Disabled` (1) — the daemon cannot claim new jobs. This is **reversible**: re-enabling flips it
 *   back to `Enabled`. To remove a daemon entirely (invalidating its credentials), delete it instead.
 *   The daemon held the plaintext org key — org-key rotation remains the remediation for a suspected
 *   compromise.
 */
export const DaemonStatus = Object.freeze({
  Enabled: 0,
  Disabled: 1,
} as const);
export type DaemonStatus = (typeof DaemonStatus)[keyof typeof DaemonStatus];

export function isDaemonStatus(value: unknown): value is DaemonStatus {
  return Object.values(DaemonStatus).includes(value as DaemonStatus);
}

export function toDaemonStatus(value: unknown): DaemonStatus | undefined {
  if (isDaemonStatus(value)) {
    return value;
  }
  if (typeof value === "string") {
    const asInt = parseInt(value, 10);
    if (isDaemonStatus(asInt)) {
      return asInt;
    }
  }
  return undefined;
}

/**
 * What triggered a rotation job. Mirrors the server's tinyint `Source` on `PamRotationJob`.
 * Allium spec: RotationSource.
 *
 * - `Scheduled` (0)  — the Quartz cron schedule fired.
 * - `OnDemand` (1)   — an operator pressed "Rotate now" in the admin console.
 * - `AccessEnd` (2)  — a credential lease ended and `rotateOnAccessEnd` is set on the config.
 */
export const RotationSource = Object.freeze({
  Scheduled: 0,
  OnDemand: 1,
  AccessEnd: 2,
} as const);
export type RotationSource = (typeof RotationSource)[keyof typeof RotationSource];

export function isRotationSource(value: unknown): value is RotationSource {
  return Object.values(RotationSource).includes(value as RotationSource);
}

export function toRotationSource(value: unknown): RotationSource | undefined {
  if (isRotationSource(value)) {
    return value;
  }
  if (typeof value === "string") {
    const asInt = parseInt(value, 10);
    if (isRotationSource(asInt)) {
      return asInt;
    }
  }
  return undefined;
}

/**
 * Overall status of a rotation job. Mirrors the server's tinyint `Status` on `PamRotationJob`.
 * Allium spec: RotationJobStatus.
 *
 * - `Pending` (0)   — job queued, not yet claimed by a daemon.
 * - `Claimed` (1)   — a daemon is executing the job.
 * - `Succeeded` (2) — all rotation attempts succeeded and the vault cipher has been updated.
 * - `Failed` (3)    — the job exhausted its retry budget.
 * - `TimedOut` (4)  — the daemon did not report back within the deadline.
 */
export const RotationJobStatus = Object.freeze({
  Pending: 0,
  Claimed: 1,
  Succeeded: 2,
  Failed: 3,
  TimedOut: 4,
} as const);
export type RotationJobStatus = (typeof RotationJobStatus)[keyof typeof RotationJobStatus];

export function isRotationJobStatus(value: unknown): value is RotationJobStatus {
  return Object.values(RotationJobStatus).includes(value as RotationJobStatus);
}

export function toRotationJobStatus(value: unknown): RotationJobStatus | undefined {
  if (isRotationJobStatus(value)) {
    return value;
  }
  if (typeof value === "string") {
    const asInt = parseInt(value, 10);
    if (isRotationJobStatus(asInt)) {
      return asInt;
    }
  }
  return undefined;
}

/**
 * Per-attempt outcome within a rotation job. Mirrors the server's tinyint `Status` on `PamRotationAttempt`.
 * Allium spec: RotationAttemptStatus.
 *
 * - `Executing` (0) — the daemon is actively running this attempt.
 * - `Rotated` (1)   — the target system accepted the new credential.
 * - `Errored` (2)   — the attempt failed (see `failureReason`).
 * - `Abandoned` (3) — the attempt was abandoned (e.g. daemon revoked mid-job).
 */
export const RotationAttemptStatus = Object.freeze({
  Executing: 0,
  Rotated: 1,
  Errored: 2,
  Abandoned: 3,
} as const);
export type RotationAttemptStatus =
  (typeof RotationAttemptStatus)[keyof typeof RotationAttemptStatus];

export function isRotationAttemptStatus(value: unknown): value is RotationAttemptStatus {
  return Object.values(RotationAttemptStatus).includes(value as RotationAttemptStatus);
}

export function toRotationAttemptStatus(value: unknown): RotationAttemptStatus | undefined {
  if (isRotationAttemptStatus(value)) {
    return value;
  }
  if (typeof value === "string") {
    const asInt = parseInt(value, 10);
    if (isRotationAttemptStatus(asInt)) {
      return asInt;
    }
  }
  return undefined;
}

/**
 * Whether the daemon successfully wrote the rotated credential back to the vault cipher.
 * Mirrors the server's tinyint `SyncState` on `PamRotationAttempt`.
 * Allium spec: RotationSyncState.
 *
 * - `TargetUnchanged` (0) — the target system was not modified; no vault write was attempted.
 * - `TargetUpdated` (1)   — the target system accepted the new credential and the vault cipher was updated.
 * - `Indeterminate` (2)   — the target-system call may or may not have applied (network/timeout); no vault write.
 */
export const RotationSyncState = Object.freeze({
  TargetUnchanged: 0,
  TargetUpdated: 1,
  Indeterminate: 2,
} as const);
export type RotationSyncState = (typeof RotationSyncState)[keyof typeof RotationSyncState];

export function isRotationSyncState(value: unknown): value is RotationSyncState {
  return Object.values(RotationSyncState).includes(value as RotationSyncState);
}

export function toRotationSyncState(value: unknown): RotationSyncState | undefined {
  if (isRotationSyncState(value)) {
    return value;
  }
  if (typeof value === "string") {
    const asInt = parseInt(value, 10);
    if (isRotationSyncState(asInt)) {
      return asInt;
    }
  }
  return undefined;
}

/**
 * Whether the daemon terminated the user's active session after rotating the credential.
 * Mirrors the server's tinyint `SessionTermination` on `PamRotationAttempt`.
 * Allium spec: RotationSessionTermination.
 *
 * - `NotRequested` (0) — session termination was not requested for this config.
 * - `Terminated` (1)   — the session was successfully terminated.
 * - `TermFailed` (2)   — session termination was requested but failed (rotation still succeeded).
 */
export const RotationSessionTermination = Object.freeze({
  NotRequested: 0,
  Terminated: 1,
  TermFailed: 2,
} as const);
export type RotationSessionTermination =
  (typeof RotationSessionTermination)[keyof typeof RotationSessionTermination];

export function isRotationSessionTermination(value: unknown): value is RotationSessionTermination {
  return Object.values(RotationSessionTermination).includes(value as RotationSessionTermination);
}

export function toRotationSessionTermination(
  value: unknown,
): RotationSessionTermination | undefined {
  if (isRotationSessionTermination(value)) {
    return value;
  }
  if (typeof value === "string") {
    const asInt = parseInt(value, 10);
    if (isRotationSessionTermination(asInt)) {
      return asInt;
    }
  }
  return undefined;
}

/**
 * Password generation policy for a target system. The daemon uses this policy when generating
 * the new credential before writing it to both the target system and the vault cipher.
 * Allium spec: PasswordPolicy (value object on TargetSystem).
 */
export type PasswordPolicy = {
  minLength: number;
  maxLength: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeDigits: boolean;
  includeSymbols: boolean;
};
