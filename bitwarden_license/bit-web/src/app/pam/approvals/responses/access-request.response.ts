import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import type {
  AccessApprover,
  AccessDecider,
  AccessDecisionVerdict,
  AccessLeaseId,
  AccessLeaseStatus,
  AccessRequestDecisionView,
  AccessRequestId,
  AccessRequestStatus,
  AccessRequestView,
} from "../../abstractions/access-lease";

/**
 * Widen a wire string into one of the SDK's branded id types. The server has already validated the
 * value; re-validating here would only add a failure mode to a read the caller cannot influence.
 */
function asId<T>(value: string): T {
  return value as unknown as T;
}

/**
 * Normalise a wire request status onto the SDK's spelling.
 *
 * Two adjustments matter. The SDK spells the cancelled state `canceled` with one L, and a server
 * that ever sends the two-L spelling would otherwise fall through to `unknown` and render as
 * "Unknown" rather than "Canceled". Anything genuinely unrecognised does become `unknown`, which the
 * UI renders as such rather than guessing — a status this client has never heard of is a real
 * possibility once the server moves ahead of it.
 */
export function toAccessRequestStatus(value: unknown): AccessRequestStatus {
  switch (String(value).toLowerCase()) {
    case "pending":
      return "pending";
    case "approved":
      return "approved";
    case "activated":
      return "activated";
    case "denied":
      return "denied";
    case "canceled":
    case "cancelled":
      return "canceled";
    case "expired":
      return "expired";
    default:
      return "unknown";
  }
}

/**
 * Normalise a wire lease status onto the SDK's spelling.
 *
 * The SDK has no `cancelled` value: a holder ending their own lease and an operator revoking it are
 * both `revoked`, and the two are told apart from the decision log instead (see
 * `historyDisplayStatus`). Collapsing `cancelled` here keeps that one rule in one place.
 */
export function toAccessLeaseStatus(value: unknown): AccessLeaseStatus | undefined {
  if (value == null) {
    return undefined;
  }
  switch (String(value).toLowerCase()) {
    case "active":
      return "active";
    case "expired":
      return "expired";
    case "revoked":
    case "cancelled":
    case "canceled":
      return "revoked";
    default:
      return "unknown";
  }
}

/**
 * Normalise a wire verdict onto the SDK's spelling. Accepts the numeric form (`0` deny, `1` approve)
 * as well as the string form, because the decision endpoint's own request body has historically used
 * integers while the read models use strings.
 */
export function toAccessDecisionVerdict(value: unknown): AccessDecisionVerdict {
  if (value === 0 || value === "0") {
    return "deny";
  }
  if (value === 1 || value === "1") {
    return "approve";
  }
  switch (String(value).toLowerCase()) {
    case "deny":
      return "deny";
    case "approve":
      return "approve";
    default:
      return "unknown";
  }
}

/**
 * One entry of a request's decision log, shaped as the SDK's {@link AccessRequestDecisionView}.
 *
 * The wire form is flat (`DeciderKind` plus the approver's `Id`/`Name`/`Email`); the SDK models the
 * same thing as a tagged `decider`. Converting here rather than at each call site means every helper
 * written against the SDK view — `findHumanDecision`, `humanApprover`, `resolveResolver` — works on
 * these responses unchanged.
 */
export class AccessRequestDecisionResponse
  extends BaseResponse
  implements AccessRequestDecisionView
{
  readonly decider: AccessDecider;
  readonly verdict: AccessDecisionVerdict;
  readonly comment: string | undefined;
  readonly decidedAt: string;

  constructor(response: unknown) {
    super(response);
    const kind = String(this.getResponseProperty("DeciderKind")).toLowerCase();
    this.decider = kind === "automatic" ? "automatic" : { human: this.approver() };
    this.verdict = toAccessDecisionVerdict(this.getResponseProperty("Verdict"));
    this.comment = this.getResponseProperty("Comment") ?? undefined;
    this.decidedAt = this.getResponseProperty("DecidedAt");
  }

  private approver(): AccessApprover {
    const id = this.getResponseProperty("Id");
    return {
      id: id == null ? undefined : asId(id),
      name: this.getResponseProperty("Name") ?? undefined,
      email: this.getResponseProperty("Email") ?? undefined,
    };
  }
}

/**
 * An access request as the approver-facing endpoints return it, shaped as the SDK's
 * {@link AccessRequestView}.
 *
 * Mirroring the SDK view field for field is the whole point: the inbox and the history table then
 * reuse the row builders the requester-facing pages already use (`toRequestRow`,
 * `historyDisplayStatus`, `resolveResolver`, `requestedWindowSeconds`) instead of growing a parallel
 * set. When these three routes move into the SDK, this class is deleted and nothing downstream
 * changes.
 *
 * Note on the decision endpoint's response: only `status`, `resolvedAt`, and the decision just
 * recorded are guaranteed populated. The denormalised requester identity and `producedLeaseId` come
 * back empty until the next read, which is why callers keep the fields they already resolved rather
 * than replacing a row wholesale.
 */
export class AccessRequestDetailsResponse extends BaseResponse implements AccessRequestView {
  readonly id: AccessRequestId;
  readonly cipherId: AccessRequestView["cipherId"];
  readonly collectionId: AccessRequestView["collectionId"];
  readonly organizationId: AccessRequestView["organizationId"];
  readonly requesterId: AccessRequestView["requesterId"];
  readonly ruleId: AccessRequestView["ruleId"];
  readonly status: AccessRequestStatus;
  readonly leaseNotBefore: string;
  readonly leaseNotAfter: string;
  readonly reason: string | undefined;
  readonly submittedAt: string;
  readonly resolvedAt: string | undefined;
  readonly decisions: AccessRequestDecisionView[];
  readonly producedLeaseId: AccessLeaseId | undefined;
  readonly producedLeaseStatus: AccessLeaseStatus | undefined;
  readonly extensionOfLeaseId: AccessLeaseId | undefined;
  readonly requesterName: string | undefined;
  readonly requesterEmail: string | undefined;

  /** When the server marked the request lapsed while still pending; absent otherwise. */
  readonly expiredAt: string | undefined;

  constructor(response: unknown) {
    super(response);
    this.id = asId(this.getResponseProperty("Id"));
    this.cipherId = asId(this.getResponseProperty("CipherId"));
    this.collectionId = asId(this.getResponseProperty("CollectionId"));
    this.organizationId = optionalId(this.getResponseProperty("OrganizationId"));
    this.requesterId = asId(this.getResponseProperty("RequesterId"));
    this.ruleId = optionalId(this.getResponseProperty("RuleId"));
    this.status = toAccessRequestStatus(this.getResponseProperty("Status"));
    this.submittedAt = this.getResponseProperty("SubmittedAt");
    // The SDK view treats the window as always resolved at submit, because this server resolves it
    // then. A response missing either bound falls back to the submit time, which reads as a
    // zero-length window and so drops out of the actionable inbox — the safe direction, since
    // deciding a request that could grant nothing is worse than not offering the decision.
    this.leaseNotBefore = this.getResponseProperty("LeaseNotBefore") ?? this.submittedAt;
    this.leaseNotAfter = this.getResponseProperty("LeaseNotAfter") ?? this.submittedAt;
    this.reason = this.getResponseProperty("Reason") ?? undefined;
    this.resolvedAt = this.getResponseProperty("ResolvedAt") ?? undefined;
    this.expiredAt = this.getResponseProperty("ExpiredAt") ?? undefined;
    this.decisions = ((this.getResponseProperty("Decisions") as unknown[]) ?? []).map(
      (decision) => new AccessRequestDecisionResponse(decision),
    );
    this.producedLeaseId = optionalId(this.getResponseProperty("ProducedLeaseId"));
    this.producedLeaseStatus = toAccessLeaseStatus(this.getResponseProperty("ProducedLeaseStatus"));
    this.extensionOfLeaseId = optionalId(this.getResponseProperty("ExtensionOfLeaseId"));
    this.requesterName = this.getResponseProperty("RequesterName") ?? undefined;
    this.requesterEmail = this.getResponseProperty("RequesterEmail") ?? undefined;
  }
}

function optionalId<T>(value: string | null | undefined): T | undefined {
  return value == null ? undefined : asId<T>(value);
}
