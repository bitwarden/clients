import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

/**
 * Prototype-only view types for Access Requests. These mirror the shape of
 * `AccessRequestView` from `@bitwarden/sdk-internal` without the branded ID types
 * so stories can hand-build fixtures without touching the Rust SDK.
 *
 * The real `AccessRequestView` lives at
 * {@link ../../abstractions/access-lease.ts} — swap it in when wiring to the SDK.
 */

/**
 * Lifecycle states a request can be in. The three "live-lease" states
 * (`readyToUse`, `active`, `endingSoon`) are post-approval states derived from the lease
 * window — the Approvals list surfaces them as distinct badges rather than lumping them
 * under `"approved"` so the admin can see at a glance which rows are still consuming
 * entitlement.
 *
 * `revoked` and `sessionEnded` are terminal history states that only appear in the History
 * tab — they represent what happened to a lease once it closed. `expired` here means the
 * approval window passed without any lease ever being issued.
 */
export type AccessRequestStatus =
  | "pending"
  | "approved"
  | "readyToUse"
  | "active"
  | "endingSoon"
  | "denied"
  | "canceled"
  | "expired"
  | "revoked"
  | "sessionEnded";

export type AccessDecisionVerdict = "approve" | "deny";

/**
 * Three lenses the same request can be viewed through. Drives which actions appear
 * in the modal footer and which metadata gets emphasised.
 *
 * - `approvals` — approver inbox / outbox. Approve, deny, or withdraw a prior approval.
 * - `my-requests` — requester's own list. Cancel, activate, or resubmit.
 * - `history` — read-only ledger. Close only.
 */
export type AccessRequestContext = "approvals" | "my-requests" | "history";

export interface AccessApproverLike {
  /** Username / handle style, matches the Access Requests list column (e.g. `marcus.chen`). */
  name: string;
  email: string;
}

export interface AccessDecisionLike {
  decider: "automatic" | AccessApproverLike;
  verdict: AccessDecisionVerdict;
  comment?: string;
  decidedAt: string;
}

export interface AccessRequestDetailView {
  id: string;
  itemName: string;
  cipherType: CipherType;
  /** Login URI (Login ciphers) — fed to `app-vault-icon` so the favicon resolves. */
  uri?: string;
  /** Card brand (Card ciphers) — picks the right card-art SVG in `app-vault-icon`. */
  cardBrand?: string;
  /** Owning organization or team — rendered as the first metadata chip. */
  organization?: string;
  /** Owning folder / collection — rendered as the second metadata chip. */
  folder?: string;
  requester: AccessApproverLike;
  status: AccessRequestStatus;
  reason?: string;
  submittedAt: string;
  resolvedAt?: string;
  leaseNotBefore: string;
  leaseNotAfter: string;
  /**
   * Human sentence like `"8 hours, starting now"` or `"4 hours, starting tomorrow"`.
   * Shown as the Access-requested value — pre-formatted so this prototype doesn't
   * need localization helpers.
   *
   * Year convention: omit the year when the window falls in the current calendar
   * year (`"4 hours, Oct 14, 9 AM to 1 PM"`); embed it inline next to the date
   * when the window is from a prior year (`"4 hours, Oct 14, 2025, 9 AM to 1 PM"`).
   * Matches how GitHub/Linear render timestamps — keeps current-year rows scannable
   * while disambiguating History rows that have aged past year boundaries.
   */
  accessRequested: string;
  decisions: AccessDecisionLike[];
  /** True when approved but the requester has not yet opened the vault item. */
  awaitingActivation?: boolean;
  /** Minutes left in the active lease — only meaningful when `status` is `"active"`/`"endingSoon"`. */
  leaseRemaining?: string;
  /**
   * Who else can approve the request. Shown while pending so a requester knows
   * why things are quiet and an approver sees who else is on the hook.
   */
  approvers?: AccessApproverLike[];
  /**
   * Who closed the request — rendered in the History tab's "Resolved by" column.
   * `"automatic"` reads as "System" (natural expiry, auto-approve). Omitted while live.
   */
  resolvedBy?: "automatic" | AccessApproverLike;
}

/** A single label/value row rendered inside the Request details card. */
export type DetailField = { label: string; value: string; multiline?: boolean };

/** A chunk of related rows rendered as its own card in the detail dialog. */
export type DetailFieldGroup = { title: string; rows: DetailField[] };

/**
 * Clusters the request-detail fields into Details / Decision / Session groups so
 * each cluster can render as its own card. Only groups with content are returned,
 * so the dialog grows with the lifecycle.
 */
export function buildDetailFieldGroups(req: AccessRequestDetailView): DetailFieldGroup[] {
  const groups: DetailFieldGroup[] = [];

  const requestRows: DetailField[] = [
    { label: "Requester", value: req.requester.name },
    { label: "Access requested", value: req.accessRequested },
  ];
  if (req.reason) {
    requestRows.push({ label: "Request reason", value: req.reason, multiline: true });
  }
  requestRows.push({ label: "Submitted", value: req.submittedAt });
  groups.push({ title: "Details", rows: requestRows });

  const decisionRows: DetailField[] = [];
  const human = req.decisions.find((d) => d.decider !== "automatic");
  if (human && human.decider !== "automatic") {
    const verb = human.verdict === "approve" ? "Approved by" : "Denied by";
    decisionRows.push({ label: verb, value: human.decider.name });
    decisionRows.push({ label: "Email", value: human.decider.email });
    if (human.comment) {
      decisionRows.push({ label: "Decision comment", value: human.comment, multiline: true });
    }
  } else if (req.decisions.some((d) => d.decider === "automatic")) {
    decisionRows.push({ label: "Approved by", value: "System (automatic)" });
  }
  if (req.resolvedAt) {
    decisionRows.push({ label: "Resolved", value: req.resolvedAt });
  }
  if (decisionRows.length > 0) {
    groups.push({ title: "Decision", rows: decisionRows });
  }

  if (req.status === "active" || req.status === "endingSoon") {
    const remaining = req.leaseRemaining ? ` (${req.leaseRemaining} left)` : "";
    groups.push({
      title: "Session",
      rows: [{ label: "Session ends", value: `${req.leaseNotAfter}${remaining}` }],
    });
  }

  return groups;
}

/**
 * Builds the minimum `CipherViewLike` shape `app-vault-icon` needs: a numeric
 * `type` plus `login.uris[0].uri` (Login) or `card.brand` (Card). Everything
 * else `buildCipherIcon` touches is optional.
 */
export function buildCipherForRequest(req: AccessRequestDetailView): CipherViewLike {
  if (req.cipherType === CipherType.Login) {
    return {
      type: CipherType.Login,
      login: { uris: req.uri ? [{ uri: req.uri }] : [] },
    } as unknown as CipherViewLike;
  }
  if (req.cipherType === CipherType.Card) {
    return {
      type: CipherType.Card,
      card: { brand: req.cardBrand },
    } as unknown as CipherViewLike;
  }
  return { type: req.cipherType } as unknown as CipherViewLike;
}
