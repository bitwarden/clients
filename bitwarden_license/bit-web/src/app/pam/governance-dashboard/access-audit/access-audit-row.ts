import { AccessAuditEventKind, AccessAuditEventResponse } from "@bitwarden/bit-pam";

/**
 * A governance access-audit event shaped for the table. Actor and requester display names come from the server's
 * denormalized fields; cipher and collection names are resolved from local vault state (see
 * {@link AccessRequestNameResolver}), not decrypted from the response. `requestId` drives the row's drill-down to the
 * request detail page.
 */
export type AuditRow = {
  occurredAt: Date;
  kind: AccessAuditEventKind;
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
  /** The originating request, when the event has one — the row links here. */
  requestId: string | null;
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
      return "pamAuditKindRequestCancelled";
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
  return {
    occurredAt: new Date(event.occurredAt),
    kind: event.kind,
    kindLabelKey: selfEnded ? "pamAuditKindLeaseEndedByHolder" : auditKindLabelKey(event.kind),
    actor,
    requester,
    cipherName,
    collectionName,
    ruleName: event.ruleName,
    detail: event.detail,
    automated: event.automated,
    requestId: event.requestId,
    searchText: [actor, requester, cipherName, collectionName, event.ruleName, event.detail]
      .filter((value): value is string => value != null)
      .join(" ")
      .toLowerCase(),
  };
}

/** The active audit-log filter: free-text plus an optional event kind. */
export type AuditFilter = { text: string; kind: AccessAuditEventKind | null };

/** Whether a row passes the filter. Empty text and a null kind match everything. */
export function auditRowMatchesFilter(row: AuditRow, filter: AuditFilter): boolean {
  if (filter.kind != null && row.kind !== filter.kind) {
    return false;
  }
  const text = filter.text.trim().toLowerCase();
  return text === "" || row.searchText.includes(text);
}
