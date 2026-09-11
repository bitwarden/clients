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
  /** Decrypted cipher name from local vault state, null when absent from the caller's vault. */
  cipherName: string | null;
  /** The subject cipher, when the event names one — the entity the Item cell opens an event history for. */
  cipherId: string | null;
  /** Decrypted collection name from local vault state, or null. */
  collectionName: string | null;
  /** The subject collection, when the event names one — the id the drawer can open the org vault on. */
  collectionId: string | null;
  /** The access rule's name (plaintext, from the server), for rule administration events; null for others. */
  ruleName: string | null;
  /** The subject access rule, when the event names one — the identity behind a rule-named Item cell. */
  ruleId: string | null;
  /** An approver comment or a revoke reason. */
  detail: string | null;
  /** True for a system / automatic event (expiry, an automatic decision). */
  automated: boolean;
  /** True for an action whose outcome never landed (only the write-ahead attempt) — shown as an in-doubt row. */
  inDoubt: boolean;
  /**
   * The originating request, if the event has one; shown in the drawer but never as a link — the
   * request-detail page needs a different permission than AccessEventLogs.
   */
  requestId: string | null;
  /** The lease the event concerns, if any; carried, not linked, so the drawer can hand the id to support. */
  leaseId: string | null;
  /** The length of the granted access window, as an i18n key + value. Null on every other kind. */
  duration: LabelValue | null;
  /** The exact "from – to" window behind {@link duration}, for the cell's tooltip. Null exactly where {@link duration} is. */
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
  // A lease ended by its own holder is a self-end (Canceled), not an operator revoke — the
  // server projects both as LeaseRevoked, distinguished by revoked_by.
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
    collectionId: event.collectionId,
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
 * Whether the event destroyed the rule it names.
 *
 * The audit store snapshots {@link AuditRow.ruleName} at write time, so the name outlives the
 * rule — its route would 404. Read off the label key the row carries once shaped.
 */
export function auditRuleDeleted(row: AuditRow): boolean {
  return row.kindLabelKey === auditKindLabelKey(AccessAuditEventKind.RuleDeleted);
}

/**
 * The Actor filter's value for the system / automatic bucket, which has no actor identity of its own. Not a
 * possible actor id: the server writes those as GUIDs. Selecting it sends `includeAutomatedActor` rather
 * than an id, which unions the automatic events with whichever members are also selected.
 */
export const AUTOMATED_ACTOR = "automated";

const END_OF_MINUTE_MS = 59_999;

/**
 * The lower bound of an audit date range, from a `datetime-local` value. Blank or unparseable
 * means unbounded.
 *
 * Built from the parts rather than `Date.parse`, which reads a date-only string as UTC but this
 * date-time form as local.
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
 * A choice in the Time period filter, resolved to `start`/`end` bounds sent to the server.
 *
 * `allTime` sends no bounds; the server answers with everything in its ninety-day retention
 * window.
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
 * Local time throughout, matching the Time column's `date` pipe: "Today" is the start of the
 * auditor's own day, not the last 24 hours. `custom` takes its bounds from the dialog instead.
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
