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
  /** True when the action's outcome never landed (only the write-ahead attempt) — shown as an in-doubt row. */
  inDoubt: boolean;
  /** The originating request, when the event has one — the row links here. */
  requestId: string | null;
  /** Lowercased haystack for the free-text filter: actor, requester, item, and detail. */
  searchText: string;
  /** The rotation target-system display name, for rotation lifecycle and target fleet events; null otherwise. */
  targetSystemName: string | null;
  /** The rotation daemon display name, for daemon fleet events; null otherwise. */
  daemonName: string | null;
  /**
   * The source that triggered the rotation job (Scheduled=0, OnDemand=1, AccessEnd=2), for job lifecycle events.
   * Kept as a plain number to avoid coupling to the rotation const objects (ADR-0025); null when not applicable.
   */
  rotationSource: number | null;
  /**
   * The target-system sync state for a rotation attempt outcome (TargetUnchanged=0, TargetUpdated=1, Indeterminate=2).
   * Kept as a plain number to avoid coupling to the rotation const objects (ADR-0025); null when not applicable.
   */
  syncState: number | null;
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
    case AccessAuditEventKind.RotationConfigCreated:
      return "pamAuditKindRotationConfigCreated";
    case AccessAuditEventKind.RotationSettingsUpdated:
      return "pamAuditKindRotationSettingsUpdated";
    case AccessAuditEventKind.RotationAccountUpdated:
      return "pamAuditKindRotationAccountUpdated";
    case AccessAuditEventKind.RotationPaused:
      return "pamAuditKindRotationPaused";
    case AccessAuditEventKind.RotationResumed:
      return "pamAuditKindRotationResumed";
    case AccessAuditEventKind.RotationConfigDeleted:
      return "pamAuditKindRotationConfigDeleted";
    case AccessAuditEventKind.RotationOffered:
      return "pamAuditKindRotationOffered";
    case AccessAuditEventKind.RotationDispatched:
      return "pamAuditKindRotationDispatched";
    case AccessAuditEventKind.RotationSucceeded:
      return "pamAuditKindRotationSucceeded";
    case AccessAuditEventKind.RotationAttemptFailed:
      return "pamAuditKindRotationAttemptFailed";
    case AccessAuditEventKind.RotationFailed:
      return "pamAuditKindRotationFailed";
    case AccessAuditEventKind.RotationReleased:
      return "pamAuditKindRotationReleased";
    case AccessAuditEventKind.RotationTimedOut:
      return "pamAuditKindRotationTimedOut";
    case AccessAuditEventKind.RotationWriteRejected:
      return "pamAuditKindRotationWriteRejected";
    case AccessAuditEventKind.RotationReportRejected:
      return "pamAuditKindRotationReportRejected";
    case AccessAuditEventKind.ManualRotationDue:
      return "pamAuditKindManualRotationDue";
    case AccessAuditEventKind.ManualRotationRecorded:
      return "pamAuditKindManualRotationRecorded";
    case AccessAuditEventKind.DaemonRegistered:
      return "pamAuditKindDaemonRegistered";
    case AccessAuditEventKind.DaemonRevoked:
      return "pamAuditKindDaemonRevoked";
    case AccessAuditEventKind.DaemonDisabled:
      return "pamAuditKindDaemonDisabled";
    case AccessAuditEventKind.DaemonEnabled:
      return "pamAuditKindDaemonEnabled";
    case AccessAuditEventKind.DaemonDeleted:
      return "pamAuditKindDaemonDeleted";
    case AccessAuditEventKind.DaemonAssigned:
      return "pamAuditKindDaemonAssigned";
    case AccessAuditEventKind.DaemonUnassigned:
      return "pamAuditKindDaemonUnassigned";
    case AccessAuditEventKind.TargetRegistered:
      return "pamAuditKindTargetRegistered";
    case AccessAuditEventKind.TargetDisabled:
      return "pamAuditKindTargetDisabled";
    case AccessAuditEventKind.TargetEnabled:
      return "pamAuditKindTargetEnabled";
    case AccessAuditEventKind.TargetRenamed:
      return "pamAuditKindTargetRenamed";
    case AccessAuditEventKind.TargetPolicyUpdated:
      return "pamAuditKindTargetPolicyUpdated";
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
  const targetSystemName = event.targetSystemName ?? null;
  const daemonName = event.daemonName ?? null;
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
    inDoubt: event.incomplete,
    requestId: event.requestId,
    targetSystemName,
    daemonName,
    rotationSource: event.rotationSource,
    syncState: event.syncState,
    searchText: [
      actor,
      requester,
      cipherName,
      collectionName,
      event.ruleName,
      event.detail,
      targetSystemName,
      daemonName,
    ]
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
