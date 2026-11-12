import type { AccessRequestView } from "../abstractions/access-lease";
import type { AccessBadgeState } from "../access-state-badge/access-badge-state";

/** A lower rank wins on one cipher, as the SDK ranks `badgeState`. */
const RANK: Readonly<Record<"active" | "ready" | "pending", number>> = {
  active: 0,
  ready: 1,
  pending: 2,
};

const PRIVILEGED: AccessBadgeState = { kind: "privileged" };

/** The badges the caller's own requests can give; a subset of {@link AccessBadgeState}. */
type ListedBadge =
  { readonly kind: "ready" | "pending" } | { readonly kind: "active"; readonly expiresAt: Date };

/** The badge one of the caller's requests gives its cipher at `nowMs`, if any. */
function listedBadge(request: AccessRequestView, nowMs: number): ListedBadge | undefined {
  const leaseEnd = request.producedLeaseNotAfter;
  if (
    request.producedLeaseStatus === "active" &&
    leaseEnd != null &&
    Date.parse(leaseEnd) > nowMs
  ) {
    return { kind: "active", expiresAt: new Date(leaseEnd) };
  }
  // An unparseable end counts as ended, failing closed.
  const windowOpen = Date.parse(request.leaseNotAfter) > nowMs;
  if (!windowOpen) {
    return undefined;
  }
  // An approved extension pushes its lease's end out and never produces a lease of its own.
  if (
    request.status === "approved" &&
    request.producedLeaseId == null &&
    request.extensionOfLeaseId == null
  ) {
    return { kind: "ready" };
  }
  return request.status === "pending" ? { kind: "pending" } : undefined;
}

/**
 * The vault list's badge for each cipher where the caller holds a lease or a request, by cipher ID,
 * from the caller's own requests (`listMyAccessRequests`). Active outranks ready, which outranks
 * pending, as in the SDK's `badgeState`. A gated cipher left out is Privileged. Never
 * "unavailable": that needs the server's rule evaluation, so the list views do not show it.
 */
export function badgesFromMyRequests(
  requests: readonly AccessRequestView[],
  nowMs: number,
): Map<string, AccessBadgeState> {
  const badges = new Map<string, ListedBadge>();
  for (const request of requests) {
    const badge = listedBadge(request, nowMs);
    const cipherId = String(request.cipherId);
    const held = badges.get(cipherId);
    if (badge != null && (held == null || RANK[badge.kind] < RANK[held.kind])) {
      badges.set(cipherId, badge);
    }
  }
  return badges;
}

/** `cipherId`'s badge in `badges` from {@link badgesFromMyRequests}; a gated cipher left out is Privileged. */
export function listedBadgeFor(
  badges: ReadonlyMap<string, AccessBadgeState>,
  cipherId: string,
): AccessBadgeState {
  return badges.get(cipherId) ?? PRIVILEGED;
}

/**
 * When a badge from `requests` next changes on its own, as a window or a lease ends, in epoch ms;
 * `undefined` without one. Only a request whose end is still ahead gives a badge, so a server clock
 * that trails cannot cause a read on every tick.
 */
export function nextRequestListChangeMs(
  requests: readonly AccessRequestView[],
  nowMs: number,
): number | undefined {
  let next: number | undefined;
  for (const request of requests) {
    const badge = listedBadge(request, nowMs);
    if (badge == null) {
      continue;
    }
    const endMs =
      badge.kind === "active" ? badge.expiresAt.getTime() : Date.parse(request.leaseNotAfter);
    if (next === undefined || endMs < next) {
      next = endMs;
    }
  }
  return next;
}
