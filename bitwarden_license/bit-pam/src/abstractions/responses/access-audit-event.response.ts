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
} as const);
export type AccessAuditEventKind = (typeof AccessAuditEventKind)[keyof typeof AccessAuditEventKind];

/**
 * One row of the synthesized PAM access-audit trail, as the governance client renders it. Projected server-side from
 * existing PAM entity state — there is no audit record. `kind` carries the outcome; `actorId` is who performed the
 * event (null for a system / automatic event, reflected by `automated`). Subject ids/names are populated according to
 * the kind.
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
  }
}
