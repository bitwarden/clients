import { BaseResponse } from "@bitwarden/common/models/response/base.response";

/**
 * Lifecycle of an access request under the approval-as-ticket model.
 *
 * An `approved` request is a single-use *ticket*: the approver has granted
 * access but no Lease exists yet. The requester redeems the ticket
 * (`MemberStartsLease`) which mints the Lease and moves the request to
 * `activated`. A ticket left unredeemed past its redemption window transitions
 * to `expired`.
 */
export type AccessRequestStatus =
  | "pending"
  | "approved"
  | "activated"
  | "denied"
  | "cancelled"
  | "expired";

export class AccessRequestResponse extends BaseResponse {
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
  requesterUserId: string;
  status: AccessRequestStatus;
  requestedNotBefore: string | null;
  requestedNotAfter: string | null;
  requestedTtlSeconds: number;
  reason: string | null;
  submittedAt: string;
  resolvedAt: string | null;
  /**
   * When the request lapsed: the decision deadline passed while pending, or an
   * approved ticket was never redeemed in time. Distinct from `resolvedAt`,
   * which (for an expired-while-approved ticket) keeps the approval time.
   */
  expiredAt: string | null;
  resolverUserId: string | null;
  resolverComment: string | null;
  /** The lease minted when this ticket was redeemed (the inverse Lease.request). */
  leaseId: string | null;
  /** If this request is an extension of an existing lease, the parent lease id. */
  extensionOfLeaseId: string | null;
  /**
   * Deadline by which an approved on-demand ticket must be redeemed
   * (`resolvedAt + ticket_redemption_deadline`). Null until resolved and only
   * meaningful for an approved on-demand ticket.
   */
  redemptionDeadline: string | null;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.cipherId = this.getResponseProperty("CipherId");
    this.collectionId = this.getResponseProperty("CollectionId");
    this.ruleId = this.getResponseProperty("RuleId") ?? null;
    this.organizationId = this.getResponseProperty("OrganizationId") ?? null;
    this.requesterUserId = this.getResponseProperty("RequesterUserId");
    this.status = this.getResponseProperty("Status");
    this.requestedNotBefore = this.getResponseProperty("RequestedNotBefore") ?? null;
    this.requestedNotAfter = this.getResponseProperty("RequestedNotAfter") ?? null;
    this.requestedTtlSeconds = this.getResponseProperty("RequestedTtlSeconds");
    this.reason = this.getResponseProperty("Reason") ?? null;
    this.submittedAt = this.getResponseProperty("SubmittedAt");
    this.resolvedAt = this.getResponseProperty("ResolvedAt") ?? null;
    this.expiredAt = this.getResponseProperty("ExpiredAt") ?? null;
    this.resolverUserId = this.getResponseProperty("ResolverUserId") ?? null;
    this.resolverComment = this.getResponseProperty("ResolverComment") ?? null;
    this.leaseId = this.getResponseProperty("LeaseId") ?? null;
    this.extensionOfLeaseId = this.getResponseProperty("ExtensionOfLeaseId") ?? null;
    this.redemptionDeadline = this.getResponseProperty("RedemptionDeadline") ?? null;
  }
}
