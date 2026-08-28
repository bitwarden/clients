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
  /** Who performed it, as an identity — the actor filter keys on this, since two members can share a display name. */
  actorId: string | null;
  /** The access requester (name, falling back to email). */
  requester: string | null;
  /** The access requester, as an identity — see {@link AuditRow.actorId}. */
  requesterId: string | null;
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
  /** The length of the granted access window, as an i18n key + value. Null on every other kind. */
  duration: LabelValue | null;
  /** The exact "from – to" window behind {@link duration}, for the cell's tooltip. Null whenever {@link duration} is. */
  exactWindow: string | null;
  /** A lease-extended event's new lease end (the wire's ISO string). Null on every other kind. */
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

function isTimestamp(value: string | null): value is string {
  return value != null && Number.isFinite(Date.parse(value));
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
  const grantedWindow =
    event.kind === AccessAuditEventKind.LeaseActivated &&
    isTimestamp(event.leaseNotBefore) &&
    isTimestamp(event.leaseNotAfter)
      ? { leaseNotBefore: event.leaseNotBefore, leaseNotAfter: event.leaseNotAfter }
      : null;
  const extendedUntil =
    event.kind === AccessAuditEventKind.LeaseExtended && isTimestamp(event.leaseNotAfter)
      ? event.leaseNotAfter
      : null;
  return {
    occurredAt: new Date(event.occurredAt),
    kindLabelKey: selfEnded ? "pamAuditKindLeaseEndedByHolder" : auditKindLabelKey(event.kind),
    actor,
    actorId: event.actorId,
    requester,
    requesterId: event.requesterId,
    cipherName,
    collectionName,
    ruleName: event.ruleName,
    detail: event.detail,
    automated: event.automated,
    inDoubt: event.incomplete,
    requestId: event.requestId,
    duration: grantedWindow == null ? null : durationLabel(grantedWindow),
    exactWindow: grantedWindow == null ? null : exactWindow(grantedWindow),
    extendedUntil,
    searchText: [actor, requester, cipherName, collectionName, event.ruleName, event.detail]
      .filter((value): value is string => value != null)
      .join(" ")
      .toLowerCase(),
  };
}

/**
 * The Actor filter's value for the system / automatic bucket, which has no actor identity of its own.
 * Not a possible actor id: the server writes those as GUIDs.
 */
export const AUTOMATED_ACTOR = "automated";

const END_OF_MINUTE_MS = 59_999;

/**
 * Read a `datetime-local` value as an instant in the viewer's own zone, so a bound typed as 09:00 means
 * 09:00 where the auditor is sitting — the same zone the Time column's `date` pipe renders in. Built from
 * the parts rather than handed to `Date.parse`, which reads a *date-only* string as UTC and only this
 * date-time form as local.
 */
function parseLocalDateTime(value: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (parts == null) {
    return null;
  }
  const [, year, month, day, hour, minute] = parts;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/** The lower bound of an audit date range, from a `datetime-local` value. Blank or unparseable means unbounded. */
export function auditRangeStart(value: string): Date | null {
  return parseLocalDateTime(value);
}

/**
 * The upper bound of an audit date range, from a `datetime-local` value. Blank or unparseable means unbounded.
 * Carried to the end of the chosen minute, matching `EventService.formatDateFilters`, so a bound typed as 09:00
 * still admits an event recorded at 09:00:30 — which the Time column also renders as 09:00.
 */
export function auditRangeEnd(value: string): Date | null {
  const parsed = parseLocalDateTime(value);
  return parsed == null ? null : new Date(parsed.getTime() + END_OF_MINUTE_MS);
}

/** The active audit-log filter. Every dimension is independent, and an unset one matches everything. */
export type AuditFilter = {
  text: string;
  kindLabelKey: string | null;
  /** An actor identity, or {@link AUTOMATED_ACTOR} for the system bucket. */
  actorId?: string | null;
  requesterId?: string | null;
  /** Inclusive lower bound on {@link AuditRow.occurredAt}. */
  from?: Date | null;
  /** Inclusive upper bound on {@link AuditRow.occurredAt}. */
  to?: Date | null;
};

/** Whether a row passes the filter. Empty text, a null kind, a null identity and a null bound match everything. */
export function auditRowMatchesFilter(row: AuditRow, filter: AuditFilter): boolean {
  if (filter.kindLabelKey != null && row.kindLabelKey !== filter.kindLabelKey) {
    return false;
  }
  if (filter.actorId != null) {
    // The Actor cell reads "System" for every automated row whatever the wire carries as its actor, so the
    // two buckets have to split the same way that cell does.
    const wantsAutomated = filter.actorId === AUTOMATED_ACTOR;
    if (wantsAutomated !== row.automated) {
      return false;
    }
    if (!wantsAutomated && row.actorId !== filter.actorId) {
      return false;
    }
  }
  if (filter.requesterId != null && row.requesterId !== filter.requesterId) {
    return false;
  }
  const occurredAt = row.occurredAt.getTime();
  if (filter.from != null && occurredAt < filter.from.getTime()) {
    return false;
  }
  if (filter.to != null && occurredAt > filter.to.getTime()) {
    return false;
  }
  const text = filter.text.trim().toLowerCase();
  return text === "" || row.searchText.includes(text);
}
