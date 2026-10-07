import { BaseResponse } from "@bitwarden/common/models/response/base.response";

/**
 * Must match the server's `AccessAuditEventKindNames`, the wire names for both the reported `kind`
 * and the `kind` filter. A name missing here renders as "Unknown event".
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
  RotationJobReleased: "rotationJobReleased",
  RotationJobTimedOut: "rotationJobTimedOut",
  RotationCipherWriteRejected: "rotationCipherWriteRejected",
  RotationReportRejected: "rotationReportRejected",
  ManualRotationDue: "manualRotationDue",
  ManualRotationRecorded: "manualRotationRecorded",
  AccessConnectorRegistered: "accessConnectorRegistered",
  AccessConnectorRevoked: "accessConnectorRevoked",
  AccessConnectorDisabled: "accessConnectorDisabled",
  AccessConnectorEnabled: "accessConnectorEnabled",
  AccessConnectorDeleted: "accessConnectorDeleted",
  AccessConnectorAssignedToTarget: "accessConnectorAssignedToTarget",
  AccessConnectorUnassignedFromTarget: "accessConnectorUnassignedFromTarget",
  TargetSystemRegistered: "targetSystemRegistered",
  TargetSystemDisabled: "targetSystemDisabled",
  TargetSystemEnabled: "targetSystemEnabled",
  TargetSystemRenamed: "targetSystemRenamed",
  TargetSystemPolicyUpdated: "targetSystemPolicyUpdated",
  TargetSystemDeleted: "targetSystemDeleted",
} as const);
export type AccessAuditEventKind = (typeof AccessAuditEventKind)[keyof typeof AccessAuditEventKind];

/**
 * One event of the PAM access-audit trail. Names are snapshotted when the event is written; which
 * subject fields are set depends on `kind`.
 */
export class AccessAuditEventResponse extends BaseResponse {
  kind: AccessAuditEventKind;
  occurredAt: string;
  organizationId: string;
  /** Null for a system event. */
  actorId: string | null;
  /** The owner of the subject request or lease. */
  requesterId: string | null;
  collectionId: string | null;
  cipherId: string | null;
  requestId: string | null;
  leaseId: string | null;
  ruleId: string | null;
  /** An approver comment or a revoke reason, when the source carried one. */
  detail: string | null;
  leaseNotBefore: string | null;
  leaseNotAfter: string | null;
  actorName: string | null;
  actorEmail: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  /** Not sent by the server; `toAuditRow` resolves the name from the local vault. */
  cipherName: string | null;
  /** Not sent by the server; `toAuditRow` resolves the name from the local vault. */
  collectionName: string | null;
  /** Plaintext organization configuration, for rule administration events. */
  ruleName: string | null;
  /** Plaintext organization configuration, for rotation and target administration events. */
  targetSystemName: string | null;
  /** Plaintext organization configuration, for rotation and fleet administration events. */
  accessConnectorName: string | null;
  /** True for a system event with no human actor. */
  automated: boolean;
  /** True when only the write-ahead attempt was recorded, so the outcome is in doubt. */
  incomplete: boolean;

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
    this.targetSystemName = this.getResponseProperty("TargetSystemName") ?? null;
    this.accessConnectorName = this.getResponseProperty("AccessConnectorName") ?? null;
    this.automated = this.getResponseProperty("Automated");
    this.incomplete = this.getResponseProperty("Incomplete") ?? false;
  }
}
