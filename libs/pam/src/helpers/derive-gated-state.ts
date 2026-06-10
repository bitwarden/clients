import { AccessLeaseResponse } from "../abstractions/responses/access-lease.response";

import { GatedState } from "./gated-state";

export type CollectionMembershipForLeasing = {
  requireLease: boolean;
};

export function deriveGatedState(
  cipherId: string,
  memberships: readonly CollectionMembershipForLeasing[],
  activeLeases: readonly AccessLeaseResponse[],
  userId: string,
  now: Date,
): GatedState {
  // Per spec: gating applies when require_lease = true on **all** paths.
  // Any un-gated membership wins → cipher is unleased.
  if (memberships.length === 0 || memberships.some((m) => !m.requireLease)) {
    return "unleased";
  }

  const nowMs = now.getTime();
  const hasActiveLease = activeLeases.some(
    (lease) =>
      lease.cipherId === cipherId &&
      lease.requesterId === userId &&
      lease.status === "active" &&
      Date.parse(lease.notAfter) > nowMs,
  );

  return hasActiveLease ? "gated_active_lease" : "gated_no_lease";
}
