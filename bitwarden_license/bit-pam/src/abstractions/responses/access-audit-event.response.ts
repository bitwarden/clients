import { BaseResponse } from "@bitwarden/common/models/response/base.response";

/**
 * The governance vocabulary for an audit event's kind, mirroring the server's AccessAuditEventKind. The trail emits
 * only the request and lease kinds today; the rest are defined so the contract is stable as deferred kinds come online.
 */
export const AccessAuditEventKind = Object.freeze({
  RequestSubmitted: "requestSubmitted",
  RequestApproved: "requestApproved",
  RequestDenied: "requestDenied",
  RequestCancelled: "requestCancelled",
  RequestExpiredUnanswered: "requestExpiredUnanswered",
  RequestExpiredUnactivated: "requestExpiredUnactivated",
  LeaseActivated: "leaseActivated",
  LeaseActivationRejected: "leaseActivationRejected",
  LeaseExtended: "leaseExtended",
  LeaseRevoked: "leaseRevoked",
  LeaseExpired: "leaseExpired",
  CredentialAccessed: "credentialAccessed",
  CredentialAccessDenied: "credentialAccessDenied",
  RuleCreated: "ruleCreated",
  RuleUpdated: "ruleUpdated",
  RuleDeleted: "ruleDeleted",
  LeasingKillSwitchTriggered: "leasingKillSwitchTriggered",
  LeasingFreezeEnabled: "leasingFreezeEnabled",
  LeasingFreezeLifted: "leasingFreezeLifted",
  // Rotation lifecycle — defined so the contract is stable as deferred kinds come online.
  RotationConfigCreated: "rotationConfigCreated",
  RotationSettingsUpdated: "rotationSettingsUpdated",
  RotationAccountUpdated: "rotationAccountUpdated",
  RotationPaused: "rotationPaused",
  RotationResumed: "rotationResumed",
  RotationConfigDeleted: "rotationConfigDeleted",
  RotationOffered: "rotationOffered",
  RotationDispatched: "rotationDispatched",
  RotationSucceeded: "rotationSucceeded",
  RotationAttemptFailed: "rotationAttemptFailed",
  RotationFailed: "rotationFailed",
  RotationReleased: "rotationReleased",
  RotationTimedOut: "rotationTimedOut",
  RotationWriteRejected: "rotationWriteRejected",
  RotationReportRejected: "rotationReportRejected",
  ManualRotationDue: "manualRotationDue",
  ManualRotationRecorded: "manualRotationRecorded",
  // Rotation fleet / target — defined so the contract is stable as deferred kinds come online.
  DaemonRegistered: "daemonRegistered",
  DaemonRevoked: "daemonRevoked",
  DaemonAssigned: "daemonAssigned",
  DaemonUnassigned: "daemonUnassigned",
  TargetRegistered: "targetRegistered",
  TargetDisabled: "targetDisabled",
  TargetEnabled: "targetEnabled",
  TargetRenamed: "targetRenamed",
  TargetPolicyUpdated: "targetPolicyUpdated",
} as const);
export type AccessAuditEventKind = (typeof AccessAuditEventKind)[keyof typeof AccessAuditEventKind];

/**
 * One row of the PAM access-audit trail, as the governance client renders it. Read from the dedicated audit store,
 * where each event was written self-contained (display names snapshotted at write time). `kind` carries the outcome;
 * `actorId` is who performed the event (null for a system / automatic event, reflected by `automated`). Subject
 * ids/names are populated according to the kind.
 */
export class AccessAuditEventResponse extends BaseResponse {
  kind: AccessAuditEventKind;
  occurredAt: string;
  organizationId: string;
  /** Who performed the event; null for a system / automatic event. */
  actorId: string | null;
  /** The owner of the subject request or lease. */
  requesterId: string | null;
  collectionId: string | null;
  cipherId: string | null;
  requestId: string | null;
  leaseId: string | null;
  ruleId: string | null;
  /** An approver comment or a revoke reason, if the source carried one. */
  detail: string | null;
  leaseNotBefore: string | null;
  leaseNotAfter: string | null;
  actorName: string | null;
  actorEmail: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  /** Encrypted — decrypt before display. */
  cipherName: string | null;
  /** Encrypted — decrypt before display. */
  collectionName: string | null;
  /** The access rule's name — plaintext org configuration (not vault data), for rule administration events. */
  ruleName: string | null;
  /** True when there is no human actor — a system / automatic event. */
  automated: boolean;
  /** True when the action's outcome never landed (only the write-ahead attempt was recorded) — an in-doubt entry. */
  incomplete: boolean;

  // --- Rotation fields (populated for rotation-lifecycle and fleet/target event kinds) ---

  /** The rotation target-system id, when the event is about a target system or a config bound to one. */
  targetSystemId: string | null;
  /** The rotation target-system display name snapshotted at write time; plaintext org configuration. */
  targetSystemName: string | null;
  /** The rotation daemon id, when the event is about a daemon or its assignments. */
  daemonId: string | null;
  /** The rotation daemon display name snapshotted at write time; plaintext org configuration. */
  daemonName: string | null;
  /** The rotation config id, when the event is about a managed credential's rotation config. */
  rotationConfigId: string | null;
  /** The rotation job id that the event is scoped to, when relevant. */
  rotationJobId: string | null;
  /**
   * The source that triggered the rotation job, when the event is a job lifecycle event.
   * Numeric tinyint: Scheduled = 0, OnDemand = 1, AccessEnd = 2.
   * Kept as a plain number here to avoid coupling to the rotation const objects (ADR-0025);
   * callers may cast to `RotationSource` from `@bitwarden/bit-pam` if needed.
   */
  rotationSource: number | null;
  /**
   * The target-system sync state recorded for a rotation attempt outcome.
   * Numeric tinyint: TargetUnchanged = 0, TargetUpdated = 1, Indeterminate = 2.
   * Kept as a plain number here to avoid coupling to the rotation const objects (ADR-0025);
   * callers may cast to `RotationSyncState` from `@bitwarden/bit-pam` if needed.
   */
  syncState: number | null;

  constructor(response: unknown) {
    super(response);
    this.kind = this.getResponseProperty("Kind");
    this.occurredAt = this.getResponseProperty("OccurredAt");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.actorId = this.getResponseProperty("ActorId") ?? null;
    this.requesterId = this.getResponseProperty("RequesterId") ?? null;
    this.collectionId = this.getResponseProperty("CollectionId") ?? null;
    this.cipherId = this.getResponseProperty("CipherId") ?? null;
    this.requestId = this.getResponseProperty("RequestId") ?? null;
    this.leaseId = this.getResponseProperty("LeaseId") ?? null;
    this.ruleId = this.getResponseProperty("RuleId") ?? null;
    this.detail = this.getResponseProperty("Detail") ?? null;
    this.leaseNotBefore = this.getResponseProperty("LeaseNotBefore") ?? null;
    this.leaseNotAfter = this.getResponseProperty("LeaseNotAfter") ?? null;
    this.actorName = this.getResponseProperty("ActorName") ?? null;
    this.actorEmail = this.getResponseProperty("ActorEmail") ?? null;
    this.requesterName = this.getResponseProperty("RequesterName") ?? null;
    this.requesterEmail = this.getResponseProperty("RequesterEmail") ?? null;
    this.cipherName = this.getResponseProperty("CipherName") ?? null;
    this.collectionName = this.getResponseProperty("CollectionName") ?? null;
    this.ruleName = this.getResponseProperty("RuleName") ?? null;
    this.automated = this.getResponseProperty("Automated");
    this.incomplete = this.getResponseProperty("Incomplete") ?? false;
    this.targetSystemId = this.getResponseProperty("TargetSystemId") ?? null;
    this.targetSystemName = this.getResponseProperty("TargetSystemName") ?? null;
    this.daemonId = this.getResponseProperty("DaemonId") ?? null;
    this.daemonName = this.getResponseProperty("DaemonName") ?? null;
    this.rotationConfigId = this.getResponseProperty("RotationConfigId") ?? null;
    this.rotationJobId = this.getResponseProperty("RotationJobId") ?? null;
    this.rotationSource = this.getResponseProperty("RotationSource") ?? null;
    this.syncState = this.getResponseProperty("SyncState") ?? null;
  }
}
