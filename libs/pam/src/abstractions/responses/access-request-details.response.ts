import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { AccessLeaseStatus } from "./access-lease.response";
import { AccessRequestStatus } from "./access-request.response";

/**
 * An access request with its denormalized display fields (cipher/collection
 * names, requester identity), as returned by the approver inbox, the caller's
 * own request list, the decision endpoint, and the cipher access-state
 * snapshot.
 *
 * `cipherName` and `collectionName` arrive as encrypted blobs (EncString
 * payload strings), not plaintext — the approver inbox service decrypts both
 * with the owning org's key before pushing rows to subscribers. No other
 * cipher field is exposed.
 *
 * The decision endpoint (`POST /leasing/requests/{id}/decision`) returns this
 * shape but only `status`, `resolvedAt`, and `approverComment` are guaranteed
 * to be populated; denormalized display fields and `producedLeaseId` come back
 * null.
 */
export class AccessRequestDetailsResponse extends BaseResponse {
  id: string;
  cipherId: string;
  collectionId: string;
  /**
   * The access rule that gated the cipher and that this request is evaluated
   * against (resolved at submit time). Null when the gating rule is not modelled
   * (e.g. the demo member flow), in which case lease constraints do not apply.
   */
  ruleId: string | null;
  /** Owning organization, surfaced for org-scoped operations (kill switch / freeze). */
  organizationId: string | null;
  requesterId: string;
  status: AccessRequestStatus;
  requestedNotBefore: string | null;
  requestedNotAfter: string | null;
  requestedTtlSeconds: number;
  reason: string | null;
  submittedAt: string;
  resolvedAt: string | null;
  /**
   * When the request lapsed: the decision deadline passed while pending, or an
   * approved request was never activated in time. Distinct from `resolvedAt`,
   * which (for an expired-while-approved request) keeps the approval time.
   */
  expiredAt: string | null;
  approverId: string | null;
  approverComment: string | null;
  /** The lease minted when this approved request was activated. */
  producedLeaseId: string | null;
  /**
   * The produced lease's status (`active | expired | revoked`), or null when no lease exists. Lets the inbox tell a
   * still-live lease from one that has ended, so an ended lease is not shown as active/revocable.
   */
  producedLeaseStatus: AccessLeaseStatus | null;
  /** If this request is an extension of an existing lease, the parent lease id. */
  extensionOfLeaseId: string | null;
  /**
   * Deadline by which an approved on-demand request must be activated. Null
   * until resolved and only meaningful for an approved on-demand request.
   */
  activationDeadline: string | null;
  cipherName: string | null;
  collectionName: string | null;
  requesterName: string | null;
  requesterEmail: string | null;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.cipherId = this.getResponseProperty("CipherId");
    this.collectionId = this.getResponseProperty("CollectionId");
    this.ruleId = this.getResponseProperty("RuleId") ?? null;
    this.organizationId = this.getResponseProperty("OrganizationId") ?? null;
    this.requesterId = this.getResponseProperty("RequesterId");
    this.status = this.getResponseProperty("Status");
    this.requestedNotBefore = this.getResponseProperty("RequestedNotBefore") ?? null;
    this.requestedNotAfter = this.getResponseProperty("RequestedNotAfter") ?? null;
    this.requestedTtlSeconds = this.getResponseProperty("RequestedTtlSeconds");
    this.reason = this.getResponseProperty("Reason") ?? null;
    this.submittedAt = this.getResponseProperty("SubmittedAt");
    this.resolvedAt = this.getResponseProperty("ResolvedAt") ?? null;
    this.expiredAt = this.getResponseProperty("ExpiredAt") ?? null;
    this.approverId = this.getResponseProperty("ApproverId") ?? null;
    this.approverComment = this.getResponseProperty("ApproverComment") ?? null;
    this.producedLeaseId = this.getResponseProperty("ProducedLeaseId") ?? null;
    this.producedLeaseStatus = this.getResponseProperty("ProducedLeaseStatus") ?? null;
    this.extensionOfLeaseId = this.getResponseProperty("ExtensionOfLeaseId") ?? null;
    this.activationDeadline = this.getResponseProperty("ActivationDeadline") ?? null;
    this.cipherName = this.getResponseProperty("CipherName") ?? null;
    this.collectionName = this.getResponseProperty("CollectionName") ?? null;
    this.requesterName = this.getResponseProperty("RequesterName") ?? null;
    this.requesterEmail = this.getResponseProperty("RequesterEmail") ?? null;
  }
}
