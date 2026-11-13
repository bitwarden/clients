import type { AccessLeaseView, CipherAccessStateView } from "@bitwarden/sdk-internal";

/** Whether the lease's window is still open. An unparseable `notAfter` counts as lapsed, failing closed. */
export function isLeaseLive(lease: Pick<AccessLeaseView, "notAfter">, nowMs: number): boolean {
  return Date.parse(lease.notAfter) > nowMs;
}

/**
 * The active lease, or `undefined` once its window has closed, since nothing announces a lease
 * running out. It does not re-rank `badgeState`, which the SDK already orders.
 */
export function liveActiveLease(
  state: CipherAccessStateView | null | undefined,
  nowMs: number,
): AccessLeaseView | undefined {
  const lease = state?.activeLease;
  return lease != null && isLeaseLive(lease, nowMs) ? lease : undefined;
}
