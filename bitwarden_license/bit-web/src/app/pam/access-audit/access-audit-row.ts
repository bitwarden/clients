import { LabelValue, durationLabel, exactWindow } from "../helpers/approval-window";

import {
  AccessAuditEventKind,
  AccessAuditEventResponse,
} from "./responses/access-audit-event.response";

/**
 * A governance access-audit event shaped for the table. Actor and requester display names come from the server's
 * denormalized fields; cipher and collection names are resolved from local vault state (see
 * {@link AccessRequestNameResolver}), not decrypted from the response. `requestId` drives the row's drill-down to the
 * request detail page.
 */
export type AuditRow = {
  occurredAt: Date;
  /** i18n key for the human-readable event label (see {@link auditKindLabelKey}). */
  kindLabelKey: string;
  /** Who performed it (name, falling back to email); null for a system / automatic event. */
  actor: string | null;
  /** The access requester (name, falling back to email). */
  requester: string | null;
  /** Decrypted cipher name from local vault state, or null when the item isn't in the caller's vault. */
  cipherName: string | null;
  /** Decrypted collection name from local vault state, or null. */
  collectionName: string | null;
  /** The access rule's name (plaintext, provided by the server), for rule administration events; null otherwise. */
  ruleName: string | null;
  /** An approver comment or a revoke reason, if any. */
  detail: string | null;
  /** True for a system / automatic event (expiry, an automatic decision). */
  automated: boolean;
  /** True when the action's outcome never landed (only the write-ahead attempt) — shown as an in-doubt row. */
  inDoubt: boolean;
  /**
   * The originating request, when the event has one. Carried but not rendered: the request-detail page
   * is authorized for the requester or a managing approver, not for AccessEventLogs, so this trail
   * offers no drill-down (see {@link AccessAuditComponent}).
   */
  requestId: string | null;
  /**
   * The length of the granted access window, as an i18n key + value, on the one kind that states a
   * complete one. Null on every other kind — see {@link toAuditRow}.
   */
  duration: LabelValue | null;
  /** The exact "from – to" window behind {@link duration}, for the cell's tooltip. Null whenever {@link duration} is. */
  durationWindow: string | null;
  /**
   * A lease-extended event's new lease end (the wire's ISO string). The only bound that kind
   * carries, so it is stated as an end rather than a length. Null on every other kind.
   */
  extendedUntil: string | null;
  /** Lowercased haystack for the free-text filter: actor, requester, item, and detail. */
  searchText: string;
};

/** The i18n key for an event kind's label. */
export function auditKindLabelKey(kind: AccessAuditEventKind): string {
  switch (kind) {
    case AccessAuditEventKind.RequestSubmitted:
      return "pamAuditKindRequestSubmitted";
    case AccessAuditEventKind.RequestApproved:
      return "pamAuditKindRequestApproved";
    case AccessAuditEventKind.RequestDenied:
      return "pamAuditKindRequestDenied";
    case AccessAuditEventKind.RequestCancelled:
      return "pamAuditKindRequestCanceled";
    case AccessAuditEventKind.RequestExpiredUnanswered:
      return "pamAuditKindRequestExpiredUnanswered";
    case AccessAuditEventKind.RequestExpiredUnactivated:
      return "pamAuditKindRequestExpiredUnactivated";
    case AccessAuditEventKind.LeaseActivated:
      return "pamAuditKindLeaseActivated";
    case AccessAuditEventKind.LeaseActivationRejected:
      return "pamAuditKindLeaseActivationRejected";
    case AccessAuditEventKind.LeaseExtended:
      return "pamAuditKindLeaseExtended";
    case AccessAuditEventKind.LeaseRevoked:
      return "pamAuditKindLeaseRevoked";
    case AccessAuditEventKind.LeaseExpired:
      return "pamAuditKindLeaseExpired";
    case AccessAuditEventKind.CredentialAccessed:
      return "pamAuditKindCredentialAccessed";
    case AccessAuditEventKind.CredentialAccessDenied:
      return "pamAuditKindCredentialAccessDenied";
    case AccessAuditEventKind.RuleCreated:
      return "pamAuditKindRuleCreated";
    case AccessAuditEventKind.RuleUpdated:
      return "pamAuditKindRuleUpdated";
    case AccessAuditEventKind.RuleDeleted:
      return "pamAuditKindRuleDeleted";
    case AccessAuditEventKind.LeasingKillSwitchTriggered:
      return "pamAuditKindLeasingKillSwitchTriggered";
    case AccessAuditEventKind.LeasingFreezeEnabled:
      return "pamAuditKindLeasingFreezeEnabled";
    case AccessAuditEventKind.LeasingFreezeLifted:
      return "pamAuditKindLeasingFreezeLifted";
    default:
      return "pamAuditKindUnknown";
  }
}

/** Shape a server audit event into a display row, taking cipher/collection names from a resolved vault snapshot. */
export function toAuditRow(
  event: AccessAuditEventResponse,
  cipherNameById: Map<string, string>,
  collectionNameById: Map<string, string>,
): AuditRow {
  // A lease ended by its own holder (RevokedBy == requester) is a self-end (AccessLeaseStatus.Cancelled), not an
  // operator revoke. The server projects both as LeaseRevoked — distinguished by revoked_by — so the holder case gets
  // its own label here rather than reading "Lease revoked".
  const selfEnded =
    event.kind === AccessAuditEventKind.LeaseRevoked &&
    event.actorId != null &&
    event.actorId === event.requesterId;
  const actor = event.actorName ?? event.actorEmail ?? null;
  const requester = event.requesterName ?? event.requesterEmail ?? null;
  const cipherName =
    (event.cipherId != null ? cipherNameById.get(event.cipherId) : undefined) ?? null;
  const collectionName =
    (event.collectionId != null ? collectionNameById.get(event.collectionId) : undefined) ?? null;
  // Only an activation states a complete window this trail may report as a length. A revoke or a
  // rejected activation arrives carrying the same two bounds — a revoked lease ended at this row's
  // own timestamp, not at the granted end, and a rejected activation opened no window at all — so
  // reporting a duration on either would overstate how long access was held.
  const window =
    event.kind === AccessAuditEventKind.LeaseActivated &&
    event.leaseNotBefore != null &&
    event.leaseNotAfter != null &&
    Number.isFinite(Date.parse(event.leaseNotBefore)) &&
    Number.isFinite(Date.parse(event.leaseNotAfter))
      ? { leaseNotBefore: event.leaseNotBefore, leaseNotAfter: event.leaseNotAfter }
      : null;
  // An extension writes only the parent lease's new end (the server's RequestLeaseExtensionCommand
  // sets LeaseNotAfter alone), so there is no pair to subtract: the end is all the row can state.
  const extendedUntil =
    event.kind === AccessAuditEventKind.LeaseExtended &&
    event.leaseNotAfter != null &&
    Number.isFinite(Date.parse(event.leaseNotAfter))
      ? event.leaseNotAfter
      : null;
  return {
    occurredAt: new Date(event.occurredAt),
    kindLabelKey: selfEnded ? "pamAuditKindLeaseEndedByHolder" : auditKindLabelKey(event.kind),
    actor,
    requester,
    cipherName,
    collectionName,
    ruleName: event.ruleName,
    detail: event.detail,
    automated: event.automated,
    inDoubt: event.incomplete,
    requestId: event.requestId,
    duration: window == null ? null : durationLabel(window),
    durationWindow: window == null ? null : exactWindow(window),
    extendedUntil,
    searchText: [actor, requester, cipherName, collectionName, event.ruleName, event.detail]
      .filter((value): value is string => value != null)
      .join(" ")
      .toLowerCase(),
  };
}

/** The active audit-log filter: free-text plus an optional event-kind label key. */
export type AuditFilter = { text: string; kindLabelKey: string | null };

/** Whether a row passes the filter. Empty text and a null kind match everything. */
export function auditRowMatchesFilter(row: AuditRow, filter: AuditFilter): boolean {
  if (filter.kindLabelKey != null && row.kindLabelKey !== filter.kindLabelKey) {
    return false;
  }
  const text = filter.text.trim().toLowerCase();
  return text === "" || row.searchText.includes(text);
}
