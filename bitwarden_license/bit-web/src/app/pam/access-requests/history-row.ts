import type { AccessRequestId } from "../abstractions/access-lease";

import { MyAccessRequestRow } from "./my-access-row";

/** The end states a History row can carry. */
export const HistoryStatus = Object.freeze({
  Denied: "denied",
  Revoked: "revoked",
  Canceled: "canceled",
  Expired: "expired",
  SessionEnded: "sessionEnded",
} as const);
export type HistoryStatus = (typeof HistoryStatus)[keyof typeof HistoryStatus];

/** The Status column's and filter's copy, in the filter's order. */
export const HISTORY_STATUS_LABEL_KEYS: Readonly<Record<HistoryStatus, string>> = Object.freeze({
  [HistoryStatus.Denied]: "pamStatusDenied",
  [HistoryStatus.Revoked]: "pamStatusRevoked",
  [HistoryStatus.Canceled]: "pamStatusCanceled",
  [HistoryStatus.Expired]: "pamStatusExpired",
  [HistoryStatus.SessionEnded]: "pamStatusSessionEnded",
});

/** Who ended a request: a person, named when the server resolved them, or the system. */
export type HistoryResolver = { kind: "user"; name: string | null } | { kind: "system" };

const system: HistoryResolver = { kind: "system" };

/** A request that reached an end state, as the History tab lists it. */
export type HistoryRow = {
  /** The request id as a string, for keys and test ids. */
  id: string;
  requestId: AccessRequestId;
  cipherId: string;
  /** The gated cipher's name, falling back to its id when absent from the caller's vault. */
  cipherName: string;
  collectionName: string | null;
  status: HistoryStatus;
  requester: string;
  requesterEmail: string | null;
  resolvedBy: HistoryResolver;
  /** When the request reached its end state (ISO), which the Resolved column shows. */
  resolvedAt: string;
  resolvedAtMs: number;
};

type EndState = { status: HistoryStatus; resolvedBy: HistoryResolver; at: string | null };

/**
 * The row's end state, or null while it is still pending, waiting to be started, or running. A
 * running lease counts as ended once its end passes, since nothing tells the client it lapsed.
 */
export function toHistoryRow(row: MyAccessRequestRow, nowMs: number): HistoryRow | null {
  const end = endState(row, nowMs);
  if (end == null) {
    return null;
  }
  const resolvedAt = end.at ?? row.resolvedAt ?? row.submittedAt;
  return {
    id: String(row.id),
    requestId: row.id,
    cipherId: row.cipherId,
    cipherName: row.cipherName ?? row.cipherId,
    collectionName: row.collectionName,
    status: end.status,
    requester: row.requester,
    requesterEmail: row.requesterEmail,
    resolvedBy: end.resolvedBy,
    resolvedAt,
    resolvedAtMs: Date.parse(resolvedAt),
  };
}

function endState(row: MyAccessRequestRow, nowMs: number): EndState | null {
  const requester: HistoryResolver = { kind: "user", name: row.requester || null };
  const denier: HistoryResolver =
    row.finalDeny == null ? system : { kind: "user", name: row.finalDeny.name };
  switch (row.status) {
    case "denied":
      // Also an approval the approver withdrew before it was started, which the server settles
      // to denied under their Deny.
      return { status: HistoryStatus.Denied, resolvedBy: denier, at: row.resolvedAt };
    case "canceled":
      // Only the requester cancels; an approver's withdrawal reads denied.
      return { status: HistoryStatus.Canceled, resolvedBy: requester, at: row.resolvedAt };
    case "expired":
      return { status: HistoryStatus.Expired, resolvedBy: system, at: row.leaseNotAfter };
    case "approved":
      return approvedEndState(row, nowMs, requester, denier);
    default:
      return null;
  }
}

function approvedEndState(
  row: MyAccessRequestRow,
  nowMs: number,
  requester: HistoryResolver,
  denier: HistoryResolver,
): EndState | null {
  if (row.producedLeaseId == null) {
    // Approved but never started: ended only once its window closed unused.
    return Date.parse(row.leaseNotAfter) > nowMs
      ? null
      : { status: HistoryStatus.Expired, resolvedBy: system, at: row.leaseNotAfter };
  }
  const leaseEnd = row.extendedUntil ?? row.producedLeaseNotAfter ?? row.leaseNotAfter;
  // Falls back to now for an optimistic patch, which lands before the Deny is logged.
  const endedAt = row.finalDeny?.at ?? new Date(nowMs).toISOString();
  switch (row.producedLeaseStatus) {
    case "revoked":
      return { status: HistoryStatus.Revoked, resolvedBy: denier, at: endedAt };
    case "canceled":
      // The holder ended it early, which logs their own Deny.
      return { status: HistoryStatus.SessionEnded, resolvedBy: requester, at: endedAt };
    case "active":
      return Date.parse(leaseEnd) > nowMs
        ? null
        : { status: HistoryStatus.SessionEnded, resolvedBy: system, at: leaseEnd };
    default:
      // `expired`, plus the SDK's `unknown` default.
      return { status: HistoryStatus.SessionEnded, resolvedBy: system, at: leaseEnd };
  }
}
