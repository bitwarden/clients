import { LabelValue, durationLabel, exactWindow } from "../helpers/approval-window";

import {
  AccessAuditEventKind,
  AccessAuditEventResponse,
} from "./responses/access-audit-event.response";

/**
 * An audit event shaped for the table. Actor and requester names come from the server; cipher and
 * collection names from local vault state.
 */
export type AuditRow = {
  occurredAt: Date;
  kindLabelKey: string;
  /** Name, falling back to email; null for a system event. */
  actor: string | null;
  /** The Actor filter keys on this, since two members can share a display name. */
  actorId: string | null;
  /** Tells apart two actors whose display names collide. */
  actorEmail: string | null;
  /** Name, falling back to email. */
  requester: string | null;
  requesterId: string | null;
  requesterEmail: string | null;
  /** Null when the cipher is not in the caller's vault. */
  cipherName: string | null;
  cipherId: string | null;
  collectionName: string | null;
  collectionId: string | null;
  /** Set on rule administration events only. */
  ruleName: string | null;
  ruleId: string | null;
  targetSystemName: string | null;
  accessConnectorName: string | null;
  /** An approver comment or a revoke reason. */
  detail: string | null;
  /** True for a system event, such as an expiry or an automatic decision. */
  automated: boolean;
  /** Only the write-ahead attempt was recorded, so the action may not have completed. */
  inDoubt: boolean;
  /** Shown in the drawer but not linked; AccessEventLogs does not authorize the request page. */
  requestId: string | null;
  /** Shown, not linked, so the auditor can hand the id to support. */
  leaseId: string | null;
  /** The granted window's length on a lease-activated event; null on every other kind. */
  duration: LabelValue | null;
  /** The exact window behind {@link duration}, for its tooltip; null whenever duration is. */
  exactWindow: string | null;
  /** A lease-extended event's new end, as the wire's ISO string; null on every other kind. */
  extendedUntil: string | null;
};

const KIND_LABEL_KEYS: Record<AccessAuditEventKind, string> = {
  [AccessAuditEventKind.RequestSubmitted]: "pamAuditKindRequestSubmitted",
  [AccessAuditEventKind.RequestApproved]: "pamAuditKindRequestApproved",
  [AccessAuditEventKind.RequestDenied]: "pamAuditKindRequestDenied",
  [AccessAuditEventKind.RequestCancelled]: "pamAuditKindRequestCanceled",
  [AccessAuditEventKind.RequestExpiredUnanswered]: "pamAuditKindRequestExpiredUnanswered",
  [AccessAuditEventKind.RequestExpiredUnactivated]: "pamAuditKindRequestExpiredUnactivated",
  [AccessAuditEventKind.LeaseActivated]: "pamAuditKindAccessActivated",
  [AccessAuditEventKind.LeaseActivationRejected]: "pamAuditKindLeaseActivationRejected",
  [AccessAuditEventKind.LeaseExtended]: "pamAuditKindAccessExtended",
  [AccessAuditEventKind.LeaseRevoked]: "pamAuditKindAccessRevoked",
  [AccessAuditEventKind.LeaseExpired]: "pamAuditKindAccessExpired",
  [AccessAuditEventKind.CredentialAccessed]: "pamAuditKindCredentialAccessed",
  [AccessAuditEventKind.CredentialAccessDenied]: "pamAuditKindCredentialAccessDenied",
  [AccessAuditEventKind.RuleCreated]: "pamAuditKindRuleCreated",
  [AccessAuditEventKind.RuleUpdated]: "pamAuditKindRuleUpdated",
  [AccessAuditEventKind.RuleDeleted]: "pamAuditKindRuleDeleted",
  [AccessAuditEventKind.LeasingKillSwitchTriggered]: "pamAuditKindLeasingKillSwitchTriggered",
  [AccessAuditEventKind.LeasingFreezeEnabled]: "pamAuditKindAccessFreezeEnabled",
  [AccessAuditEventKind.LeasingFreezeLifted]: "pamAuditKindAccessFreezeLifted",
  [AccessAuditEventKind.RotationConfigCreated]: "pamAuditKindRotationConfigCreated",
  [AccessAuditEventKind.RotationSettingsUpdated]: "pamAuditKindRotationSettingsUpdated",
  [AccessAuditEventKind.RotationAccountUpdated]: "pamAuditKindRotationAccountUpdated",
  [AccessAuditEventKind.RotationPaused]: "pamAuditKindRotationPaused",
  [AccessAuditEventKind.RotationResumed]: "pamAuditKindRotationResumed",
  [AccessAuditEventKind.RotationConfigDeleted]: "pamAuditKindRotationConfigDeleted",
  [AccessAuditEventKind.RotationOffered]: "pamAuditKindRotationOfferedToConnector",
  [AccessAuditEventKind.RotationDispatched]: "pamAuditKindRotationDispatched",
  [AccessAuditEventKind.RotationSucceeded]: "pamAuditKindRotationSucceeded",
  [AccessAuditEventKind.RotationAttemptFailed]: "pamAuditKindRotationAttemptFailed",
  [AccessAuditEventKind.RotationFailed]: "pamAuditKindRotationFailed",
  [AccessAuditEventKind.RotationJobReleased]: "pamAuditKindRotationReleased",
  [AccessAuditEventKind.RotationJobTimedOut]: "pamAuditKindRotationTimedOut",
  [AccessAuditEventKind.RotationCipherWriteRejected]: "pamAuditKindRotationWriteRejected",
  [AccessAuditEventKind.RotationReportRejected]: "pamAuditKindRotationReportRejected",
  [AccessAuditEventKind.ManualRotationDue]: "pamAuditKindManualRotationDue",
  [AccessAuditEventKind.ManualRotationRecorded]: "pamAuditKindManualRotationRecorded",
  [AccessAuditEventKind.AccessConnectorRegistered]: "pamAuditKindAccessConnectorRegistered",
  [AccessAuditEventKind.AccessConnectorRevoked]: "pamAuditKindAccessConnectorRevoked",
  [AccessAuditEventKind.AccessConnectorDisabled]: "pamAuditKindAccessConnectorDeactivated",
  [AccessAuditEventKind.AccessConnectorEnabled]: "pamAuditKindAccessConnectorActivated",
  [AccessAuditEventKind.AccessConnectorDeleted]: "pamAuditKindAccessConnectorDeleted",
  [AccessAuditEventKind.AccessConnectorAssignedToTarget]: "pamAuditKindAccessConnectorAssigned",
  [AccessAuditEventKind.AccessConnectorUnassignedFromTarget]:
    "pamAuditKindAccessConnectorUnassigned",
  [AccessAuditEventKind.TargetSystemRegistered]: "pamAuditKindTargetRegistered",
  [AccessAuditEventKind.TargetSystemDisabled]: "pamAuditKindTargetDeactivated",
  [AccessAuditEventKind.TargetSystemEnabled]: "pamAuditKindTargetActivated",
  [AccessAuditEventKind.TargetSystemRenamed]: "pamAuditKindTargetRenamed",
  [AccessAuditEventKind.TargetSystemPolicyUpdated]: "pamAuditKindTargetPolicyUpdated",
  [AccessAuditEventKind.TargetSystemDeleted]: "pamAuditKindTargetDeleted",
};

/** The fallback only serves a kind from a server running ahead of this client. */
export function auditKindLabelKey(kind: AccessAuditEventKind): string {
  return KIND_LABEL_KEYS[kind] ?? "pamAuditKindUnknown";
}

/**
 * Kinds no action emits: the seven the server marks "not emitted yet", plus
 * `AccessConnectorRevoked`. Stored rows still get a label, but the Event filter leaves these out,
 * since they match nothing.
 */
export const UNEMITTED_AUDIT_KINDS: ReadonlySet<AccessAuditEventKind> = new Set([
  AccessAuditEventKind.RequestExpiredUnanswered,
  AccessAuditEventKind.RequestExpiredUnactivated,
  AccessAuditEventKind.CredentialAccessed,
  AccessAuditEventKind.CredentialAccessDenied,
  AccessAuditEventKind.LeasingKillSwitchTriggered,
  AccessAuditEventKind.LeasingFreezeEnabled,
  AccessAuditEventKind.LeasingFreezeLifted,
  AccessAuditEventKind.AccessConnectorRevoked,
]);

function isTimestamp(value: string | null): value is string {
  return value != null && Number.isFinite(Date.parse(value));
}

export function toAuditRow(
  event: AccessAuditEventResponse,
  cipherNameById: Map<string, string>,
  collectionNameById: Map<string, string>,
): AuditRow {
  // The server records a holder ending their own lease as LeaseRevoked too, with them as actor.
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
    kindLabelKey: selfEnded ? "pamAuditKindAccessEndedByRequester" : auditKindLabelKey(event.kind),
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
    targetSystemName: event.targetSystemName,
    accessConnectorName: event.accessConnectorName,
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
 * Whether the event deleted the rule it names. The snapshotted {@link AuditRow.ruleName} outlives
 * the rule, whose route would 404.
 */
export function auditRuleDeleted(row: AuditRow): boolean {
  return row.kindLabelKey === auditKindLabelKey(AccessAuditEventKind.RuleDeleted);
}

/**
 * The Actor filter's value for system events; it cannot collide with a GUID actor id. Selecting it
 * sends `includeAutomatedActor`, which unions system events with any selected members.
 */
export const AUTOMATED_ACTOR = "automated";

const END_OF_MINUTE_MS = 59_999;

/**
 * The lower bound of an audit date range, from a `datetime-local` value; blank or unparseable means
 * unbounded. Parsed from its parts, since `Date.parse` picks UTC or local time by format.
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
 * Like {@link auditRangeStart}, but carried to the end of the minute as
 * `EventService.formatDateFilters` does, so a 09:00 bound admits an event at 09:00:30.
 */
export function auditRangeEnd(value: string): Date | null {
  const start = auditRangeStart(value);
  return start == null ? null : new Date(start.getTime() + END_OF_MINUTE_MS);
}

/** A null bound leaves that side open. */
export type AuditRange = { from: Date | null; to: Date | null };

export const UNBOUNDED_AUDIT_RANGE: AuditRange = { from: null, to: null };

/**
 * A Time period filter choice. `allTime` sends no bounds, so the server returns its whole
 * ninety-day retention window.
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
 * Local time throughout, like the Time column's `date` pipe, so "Today" starts at the auditor's
 * midnight rather than 24 hours ago.
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
