import { LeaseResponse } from "../abstractions/responses/lease.response";

import { PolicyEvaluation } from "./classify-policy-evaluation";

/**
 * - "unleased"            — cipher is not gated; opens normally.
 * - "gated_no_lease"      — gated, no active lease; opening will queue for a
 *                           human approver.
 * - "gated_no_lease_auto" — gated, no active lease; opening will be evaluated
 *                           automatically by server rules (IP, time-of-day…).
 * - "gated_active_lease"  — caller already holds an active lease.
 */
export type GatedState =
  | "unleased"
  | "gated_no_lease"
  | "gated_no_lease_auto"
  | "gated_active_lease";

export type CollectionMembershipForLeasing = {
  requireLease: boolean;
};

export function deriveGatedState(
  cipherId: string,
  memberships: readonly CollectionMembershipForLeasing[],
  activeLeases: readonly LeaseResponse[],
  userId: string,
  now: Date,
  evaluation: PolicyEvaluation = "human",
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
      lease.granteeUserId === userId &&
      lease.status === "active" &&
      Date.parse(lease.notAfter) > nowMs,
  );

  if (hasActiveLease) {
    return "gated_active_lease";
  }
  return evaluation === "automated" ? "gated_no_lease_auto" : "gated_no_lease";
}
