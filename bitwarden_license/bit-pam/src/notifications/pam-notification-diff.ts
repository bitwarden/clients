import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";

import type {
  AccessLeaseView,
  AccessRequestStatus,
  AccessRequestView,
} from "../abstractions/access-lease";
import { ENDING_SOON_THRESHOLD_MS } from "../access-state-badge/access-badge-state";
import { isActionableInboxRequest } from "../approvals/inbox-request-filter";

/** How close a held lease is to ending. Ended leases are dropped from the snapshot. */
export type PamLeasePhase = "live" | "endingSoon";

/**
 * What the last read saw, kept to tell what changed on the next one. Ids and statuses only, so a
 * stored copy carries no item, folder or person.
 */
export type PamNotificationSnapshot = {
  /** Ids of the pending inbox requests the user could act on, excluding their own. */
  inbox: string[];
  /** The user's own requests by id. */
  requests: Record<string, AccessRequestStatus>;
  /** The user's leases that were still open. */
  leases: Record<string, PamLeasePhase>;
};

/**
 * One fresh read. A `null` list means that read failed, so its slice of the snapshot carries
 * over untouched rather than reading as everything having vanished.
 */
export type PamNotificationInput = {
  userId: string;
  inbox: AccessRequestView[] | null;
  requests: AccessRequestView[] | null;
  leases: AccessLeaseView[] | null;
};

export type PamNotificationEventKind =
  | "approvalRequested"
  | "requestApproved"
  | "requestDenied"
  | "requestCanceled"
  | "leaseEndingSoon"
  | "leaseEnded";

/** `id` is the request's, or the lease's for the two lease kinds. */
export type PamNotificationEvent = {
  kind: PamNotificationEventKind;
  id: string;
};

export type PamNotificationDiff = {
  events: PamNotificationEvent[];
  snapshot: PamNotificationSnapshot;
};

const DECIDED_KINDS: Partial<Record<AccessRequestStatus, PamNotificationEventKind>> = {
  approved: "requestApproved",
  denied: "requestDenied",
  canceled: "requestCanceled",
};

export function emptyPamSnapshot(): PamNotificationSnapshot {
  return { inbox: [], requests: {}, leases: {} };
}

/**
 * Compares a fresh read with the last snapshot. With no `prev` (the first read after login or
 * unlock) it only seeds, so nothing that was already there announces itself.
 *
 * Reports a new actionable inbox request not authored by the user, an own request that left
 * `pending` or `approved` for approved, denied or canceled, and an own lease that entered its
 * ending-soon window or ended. Anything first seen already decided or already ending is silent,
 * since it was never seen in its earlier state.
 */
export function diffPamState(
  prev: PamNotificationSnapshot | null,
  next: PamNotificationInput,
  now: Date,
): PamNotificationDiff {
  const snapshot: PamNotificationSnapshot = {
    inbox: next.inbox == null ? (prev?.inbox ?? []) : actionableInboxIds(next, now),
    requests: next.requests == null ? (prev?.requests ?? {}) : requestStatuses(next.requests),
    leases: next.leases == null ? (prev?.leases ?? {}) : leasePhases(next.leases, now.getTime()),
  };
  if (prev == null) {
    return { events: [], snapshot };
  }

  const events: PamNotificationEvent[] = [];
  if (next.inbox != null) {
    const seen = new Set(prev.inbox);
    for (const id of snapshot.inbox) {
      if (!seen.has(id)) {
        events.push({ kind: "approvalRequested", id });
      }
    }
  }
  if (next.requests != null) {
    for (const [id, status] of Object.entries(snapshot.requests)) {
      const before = prev.requests[id];
      const kind = DECIDED_KINDS[status];
      if (before != null && before !== status && kind != null && isUndecided(before)) {
        events.push({ kind, id });
      }
    }
  }
  if (next.leases != null) {
    for (const [id, before] of Object.entries(prev.leases)) {
      const after = snapshot.leases[id];
      if (after == null) {
        events.push({ kind: "leaseEnded", id });
      } else if (after === "endingSoon" && before === "live") {
        events.push({ kind: "leaseEndingSoon", id });
      }
    }
  }
  return { events, snapshot };
}

/**
 * When the next lease boundary (ending soon, then ended) falls after `now`, so the caller can
 * read again then, since the server pushes nothing for time passing.
 */
export function nextLeaseBoundaryMs(
  snapshot: PamNotificationSnapshot,
  leases: AccessLeaseView[],
  nowMs: number,
): number | undefined {
  let soonest: number | undefined;
  for (const lease of leases) {
    const phase = snapshot.leases[uuidAsString(lease.id)];
    if (phase == null) {
      continue;
    }
    const end = Date.parse(lease.notAfter);
    const boundary = phase === "live" ? end - ENDING_SOON_THRESHOLD_MS : end;
    if (Number.isFinite(boundary) && boundary > nowMs && (soonest == null || boundary < soonest)) {
      soonest = boundary;
    }
  }
  return soonest;
}

function isUndecided(status: AccessRequestStatus): boolean {
  return status === "pending" || status === "approved";
}

function actionableInboxIds(next: PamNotificationInput, now: Date): string[] {
  return (next.inbox ?? [])
    .filter(
      (request) =>
        uuidAsString(request.requesterId) !== next.userId && isActionableInboxRequest(request, now),
    )
    .map((request) => uuidAsString(request.id));
}

function requestStatuses(requests: AccessRequestView[]): Record<string, AccessRequestStatus> {
  const statuses: Record<string, AccessRequestStatus> = {};
  for (const request of requests) {
    statuses[uuidAsString(request.id)] = request.status;
  }
  return statuses;
}

function leasePhases(leases: AccessLeaseView[], nowMs: number): Record<string, PamLeasePhase> {
  const phases: Record<string, PamLeasePhase> = {};
  for (const lease of leases) {
    const end = Date.parse(lease.notAfter);
    // An unparseable end fails closed, as `isLeaseLive` does.
    if (lease.status !== "active" || !(end > nowMs)) {
      continue;
    }
    phases[uuidAsString(lease.id)] =
      end - nowMs <= ENDING_SOON_THRESHOLD_MS ? "endingSoon" : "live";
  }
  return phases;
}
