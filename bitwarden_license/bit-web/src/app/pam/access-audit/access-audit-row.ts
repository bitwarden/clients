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
  /** The actor's email, used to tell apart two identities whose display names collide. */
  actorEmail: string | null;
  /** The access requester (name, falling back to email). */
  requester: string | null;
  /** The access requester, as an identity — see {@link AuditRow.actorId}. */
  requesterId: string | null;
  /** The requester's email — see {@link AuditRow.actorEmail}. */
  requesterEmail: string | null;
  /** Decrypted cipher name from local vault state, or null when the item isn't in the caller's vault. */
  cipherName: string | null;
  /** The subject cipher, when the event names one — the entity the Item cell opens an event history for. */
  cipherId: string | null;
  /** Decrypted collection name from local vault state, or null. */
  collectionName: string | null;
  /** The access rule's name (plaintext, provided by the server), for rule administration events; null otherwise. */
  ruleName: string | null;
  /** The subject access rule, when the event names one — the identity behind a rule-named Item cell. */
  ruleId: string | null;
  /** An approver comment or a revoke reason, if any. */
  detail: string | null;
  /** True for a system / automatic event (expiry, an automatic decision). */
  automated: boolean;
  /** True when the action's outcome never landed (only the write-ahead attempt) — shown as an in-doubt row. */
  inDoubt: boolean;
  /**
   * The originating request, when the event has one. Shown in the details drawer but never as a link:
   * the request-detail page is authorized for the requester or a managing approver, not for
   * AccessEventLogs, so this trail offers no drill-down (see {@link AccessAuditComponent}).
   */
  requestId: string | null;
  /**
   * The lease the event concerns, when it has one. Like {@link AuditRow.requestId} it opens nothing;
   * it is carried so the details drawer can hand an auditor the id support would ask them for.
   */
  leaseId: string | null;
  /** The length of the granted access window, as an i18n key + value. Null on every other kind. */
  duration: LabelValue | null;
  /** The exact "from – to" window behind {@link duration}, for the cell's tooltip. Null whenever {@link duration} is. */
  exactWindow: string | null;
  /** A lease-extended event's new lease end (the wire's ISO string). Null on every other kind. */
  extendedUntil: string | null;
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
    actorEmail: event.actorEmail,
    requester,
    requesterId: event.requesterId,
    requesterEmail: event.requesterEmail,
    cipherName,
    cipherId: event.cipherId,
    collectionName,
    ruleName: event.ruleName,
    ruleId: event.ruleId,
    detail: event.detail,
    automated: event.automated,
    inDoubt: event.incomplete,
    requestId: event.requestId,
    leaseId: event.leaseId,
    duration: grantedWindow == null ? null : durationLabel(grantedWindow),
    exactWindow: grantedWindow == null ? null : exactWindow(grantedWindow),
    extendedUntil,
  };
}

/**
 * The identity behind the Item cell, or null when that cell renders no item.
 *
 * Mirrors what the cell actually shows: a decrypted cipher name first, an access rule name second, an em
 * dash otherwise. Keyed on the id rather than the label because two access rules can carry the same name,
 * and merging them would let an auditor read half a rule's history as the whole of it. A row whose cipher
 * did not decrypt in this viewer's vault has no name to render and so no identity to filter on — the same
 * rule the Actor chip follows for an unresolved member.
 */
export function auditItemId(row: AuditRow): string | null {
  if (row.cipherName != null) {
    return row.cipherId;
  }
  if (row.ruleName != null) {
    return row.ruleId;
  }
  return null;
}

/** The label the Item cell renders for a row, or null when it renders no item. */
export function auditItemLabel(row: AuditRow): string | null {
  return row.cipherName ?? row.ruleName;
}

/**
 * The Actor filter's value for the system / automatic bucket, which has no actor identity of its own.
 * Not a possible actor id: the server writes those as GUIDs.
 */
export const AUTOMATED_ACTOR = "automated";

const END_OF_MINUTE_MS = 59_999;

/**
 * The lower bound of an audit date range, from a `datetime-local` value. Blank or unparseable means unbounded.
 *
 * Read as an instant in the viewer's own zone, so a bound typed as 09:00 means 09:00 where the auditor is
 * sitting — the same zone the Time column's `date` pipe renders in. Built from the parts rather than handed
 * to `Date.parse`, which reads a *date-only* string as UTC and only this date-time form as local.
 */
export function auditRangeStart(value: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (parts == null) {
    return null;
  }
  const [, year, month, day, hour, minute] = parts;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

/**
 * The upper bound of an audit date range, read like {@link auditRangeStart} but carried to the end of the
 * chosen minute, matching `EventService.formatDateFilters`, so a bound typed as 09:00 still admits an event
 * recorded at 09:00:30 — which the Time column also renders as 09:00.
 */
export function auditRangeEnd(value: string): Date | null {
  const start = auditRangeStart(value);
  return start == null ? null : new Date(start.getTime() + END_OF_MINUTE_MS);
}

/** An audit date range. A null bound is unbounded on that side. */
export type AuditRange = { from: Date | null; to: Date | null };

export const UNBOUNDED_AUDIT_RANGE: AuditRange = { from: null, to: null };

/**
 * A choice in the Time period filter.
 *
 * `allTime` is the whole fetched trail, not all of history: `GET /organizations/{orgId}/audit` serves a
 * fixed 90-day window and takes no parameters, so nothing older than that window is on the client for any
 * option here to show.
 */
export type AuditTimePeriod = "today" | "past7Days" | "past30Days" | "allTime" | "custom";

/** The Time period options that carry their own bounds, in menu order. */
export const AUDIT_TIME_PRESETS: readonly AuditTimePeriod[] = ["today", "past7Days", "past30Days"];

export const AUDIT_TIME_PERIOD_LABEL_KEYS: Record<AuditTimePeriod, string> = {
  today: "recentlyActiveToday",
  past7Days: "recentlyActivePast7Days",
  past30Days: "recentlyActivePast30Days",
  allTime: "allTime",
  custom: "custom",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The bounds a preset stands for, measured against `now`.
 *
 * Local time throughout, matching the Time column's `date` pipe: "Today" is the start of the auditor's own
 * day rather than the last 24 hours, so an event at 08:00 this morning is in it and one at 22:00 last night
 * is not. `allTime` carries no bounds, and `custom` takes its bounds from the dialog instead.
 */
export function auditPresetRange(period: AuditTimePeriod, now: Date): AuditRange {
  switch (period) {
    case "today":
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()), to: null };
    case "past7Days":
      return { from: new Date(now.getTime() - 7 * DAY_MS), to: null };
    case "past30Days":
      return { from: new Date(now.getTime() - 30 * DAY_MS), to: null };
    default:
      return UNBOUNDED_AUDIT_RANGE;
  }
}

/**
 * The active audit-log filter. Every dimension is independent, and an unset one matches everything.
 *
 * The identity dimensions are lists because their chips are multi-select: an auditor reconstructing an
 * incident is usually following two or three people, not one, and narrowing to each in turn loses the
 * order events happened in.
 */
export type AuditFilter = {
  kindLabelKey: readonly string[] | null;
  /** Actor identities, or {@link AUTOMATED_ACTOR} for the system bucket. */
  actorId?: readonly string[] | null;
  requesterId?: readonly string[] | null;
  /** Item identities, as {@link auditItemId} reads them. A row with no item matches no selection. */
  itemId?: readonly string[] | null;
  /** Inclusive lower bound on {@link AuditRow.occurredAt}. */
  from?: Date | null;
  /** Inclusive upper bound on {@link AuditRow.occurredAt}. */
  to?: Date | null;
};

/** Whether a row's value is one of those selected. An empty or absent selection matches everything. */
function selects(selected: readonly string[] | null | undefined, value: string | null): boolean {
  if (selected == null || selected.length === 0) {
    return true;
  }
  return value != null && selected.includes(value);
}

/** Whether a row passes the filter. An empty selection and a null bound match everything. */
export function auditRowMatchesFilter(row: AuditRow, filter: AuditFilter): boolean {
  if (!selects(filter.kindLabelKey, row.kindLabelKey)) {
    return false;
  }
  // The Actor cell reads "System" for every automated row whatever the wire carries as its actor, so the
  // buckets split on the effective identity that cell renders rather than on the row's own actor id.
  if (!selects(filter.actorId, row.automated ? AUTOMATED_ACTOR : row.actorId)) {
    return false;
  }
  if (!selects(filter.requesterId, row.requesterId)) {
    return false;
  }
  if (!selects(filter.itemId, auditItemId(row))) {
    return false;
  }
  const occurredAt = row.occurredAt.getTime();
  if (filter.from != null && occurredAt < filter.from.getTime()) {
    return false;
  }
  if (filter.to != null && occurredAt > filter.to.getTime()) {
    return false;
  }
  return true;
}
