import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import type { OrganizationId } from "@bitwarden/common/types/guid";
import type { CipherId } from "@bitwarden/sdk-internal";

import type {
  AccessConnectorDetail,
  AccessConnectorId,
  AccessConnector,
  PasswordPolicy,
  RotationAttemptId,
  RotationAttempt,
  RotationConfigActions,
  RotationConfigDetail,
  RotationConfigId,
  RotationConfig,
  RotationJobId,
  RotationJob,
  TargetSystemId,
  TargetSystem,
} from "../rotation";
import { AccessConnectorStatus } from "../rotation";
import type { RotationConfigDescription } from "../rotation-sdk.service";

/**
 * Builders for the rotation views, so specs needn't hand-roll a cast that hides the next field the
 * SDK adds. Each takes overrides on a valid default.
 */

/**
 * A stable UUID for a label, since `asUuid` rejects ids like `"sys-1"`. A single hex digit maps to
 * the all-same-digit UUID; longer labels hash to one digit and can collide.
 */
export function id(label: string): string {
  const digit = /^[0-9a-f]$/.test(label)
    ? label
    : [...label].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 16, 7).toString(16);
  const block = digit.repeat(8);
  return `${block}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(12)}`;
}

export const ORGANIZATION_ID = asUuid<OrganizationId>(id("a"));
export const TARGET_SYSTEM_ID = asUuid<TargetSystemId>(id("1"));
export const ACCESS_CONNECTOR_ID = asUuid<AccessConnectorId>(id("2"));
export const ROTATION_CONFIG_ID = asUuid<RotationConfigId>(id("3"));
export const ROTATION_JOB_ID = asUuid<RotationJobId>(id("4"));
export const ROTATION_ATTEMPT_ID = asUuid<RotationAttemptId>(id("5"));
export const CIPHER_ID = asUuid<CipherId>(id("6"));

const TIMESTAMP = "2026-01-01T00:00:00Z";

export function passwordPolicy(overrides: Partial<PasswordPolicy> = {}): PasswordPolicy {
  return {
    minLength: 14,
    maxLength: 64,
    includeUppercase: true,
    includeLowercase: true,
    includeDigits: true,
    includeSymbols: true,
    ...overrides,
  };
}

/** An active, automatic Entra target, the shape most tests want. */
export function targetSystem(overrides: Partial<TargetSystem> = {}): TargetSystem {
  return {
    id: TARGET_SYSTEM_ID,
    organizationId: ORGANIZATION_ID,
    name: "Prod Entra",
    method: "automatic",
    kind: "entra",
    status: "active",
    passwordPolicy: passwordPolicy(),
    supportsSessionTermination: true,
    creationDate: TIMESTAMP,
    revisionDate: TIMESTAMP,
    ...overrides,
  } as TargetSystem;
}

/** An enabled, connected connector with no assignments. */
export function accessConnector(overrides: Partial<AccessConnector> = {}): AccessConnector {
  return {
    id: ACCESS_CONNECTOR_ID,
    organizationId: ORGANIZATION_ID,
    name: "Access connector 1",
    status: "enabled" as AccessConnectorStatus,
    isConnected: true,
    lastHeartbeatAt: TIMESTAMP,
    assignedTargetSystemIds: [],
    creationDate: TIMESTAMP,
    revisionDate: TIMESTAMP,
    ...overrides,
  } as AccessConnector;
}

export function accessConnectorDetail(
  overrides: Partial<AccessConnectorDetail> = {},
): AccessConnectorDetail {
  return { connector: accessConnector(), jobs: [], ...overrides };
}

/** An enabled, idle, automatic config, the one shape that offers a rotation. */
export function rotationConfig(overrides: Partial<RotationConfig> = {}): RotationConfig {
  return {
    id: ROTATION_CONFIG_ID,
    organizationId: ORGANIZATION_ID,
    cipherId: CIPHER_ID,
    targetSystemId: TARGET_SYSTEM_ID,
    targetSystemName: "Prod Entra",
    targetSystemMethod: "automatic",
    accountIdentity: "svc_rotation",
    terminateSessions: false,
    scheduleCron: undefined,
    rotateOnAccessEnd: false,
    enabled: true,
    lastRotationAt: undefined,
    nextRotationAt: undefined,
    hasActiveJob: false,
    awaitingManualRotation: false,
    creationDate: TIMESTAMP,
    revisionDate: TIMESTAMP,
    ...overrides,
  } as RotationConfig;
}

export function rotationConfigDetail(
  overrides: Partial<RotationConfigDetail> = {},
): RotationConfigDetail {
  return { config: rotationConfig(), jobs: [], ...overrides };
}

export function rotationAttempt(overrides: Partial<RotationAttempt> = {}): RotationAttempt {
  return {
    id: ROTATION_ATTEMPT_ID,
    jobId: ROTATION_JOB_ID,
    claimedByAccessConnectorId: ACCESS_CONNECTOR_ID,
    status: "rotated",
    failureReason: undefined,
    cipherUpdated: true,
    syncState: "target_updated",
    sessionTermination: "not_requested",
    startedAt: TIMESTAMP,
    endedAt: TIMESTAMP,
    ...overrides,
  } as RotationAttempt;
}

export function rotationJob(overrides: Partial<RotationJob> = {}): RotationJob {
  return {
    id: ROTATION_JOB_ID,
    rotationConfigId: ROTATION_CONFIG_ID,
    source: "scheduled",
    status: "succeeded",
    claimedByAccessConnectorId: ACCESS_CONNECTOR_ID,
    claimedAt: TIMESTAMP,
    createdAt: TIMESTAMP,
    nextClaimableAt: undefined,
    expiresAt: undefined,
    attempts: [rotationAttempt()],
    ...overrides,
  } as RotationJob;
}

/** The actions an enabled, idle, automatic config on an active target offers. */
export function rotationConfigActions(
  overrides: Partial<RotationConfigActions> = {},
): RotationConfigActions {
  return {
    canRotateNow: true,
    canRecordManual: false,
    mutationsLocked: false,
    canPause: true,
    canResume: false,
    ...overrides,
  };
}

/** The SDK-derived half of a row. Defaults to a rotatable config on a daily schedule. */
export function rotationConfigDescription(
  overrides: Partial<RotationConfigDescription> = {},
): RotationConfigDescription {
  return {
    actions: rotationConfigActions(),
    schedulePreset: "daily",
    ...overrides,
  };
}

export function sysId(label: string): TargetSystemId {
  return asUuid<TargetSystemId>(id(label));
}

export function connectorId(label: string): AccessConnectorId {
  return asUuid<AccessConnectorId>(id(label));
}

export function configId(label: string): RotationConfigId {
  return asUuid<RotationConfigId>(id(label));
}

export function jobId(label: string): RotationJobId {
  return asUuid<RotationJobId>(id(label));
}

export function attemptId(label: string): RotationAttemptId {
  return asUuid<RotationAttemptId>(id(label));
}
