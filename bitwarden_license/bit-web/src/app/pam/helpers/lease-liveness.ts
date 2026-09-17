import type { AccessLeaseView, CipherAccessStateView } from "../abstractions/access-lease";

/**
 * The caller's active lease over the cipher, or `undefined` once its window has closed.
 *
 * A lease IS the access, so the client stops treating it as one the instant it lapses — whatever a
 * response fetched a moment earlier still says, and without waiting to ask the server again.
 * `AccessStateBadgeComponent` reads its countdown the same way, for the same reason.
 *
 * A `notAfter` that will not parse counts as lapsed: this guards a credential, so the unreadable
 * case fails closed.
 */
export function liveActiveLease(
  state: CipherAccessStateView | null | undefined,
  nowMs: number,
): AccessLeaseView | undefined {
  const lease = state?.activeLease;
  return lease != null && Date.parse(lease.notAfter) > nowMs ? lease : undefined;
}

/**
 * Milliseconds until the active lease's window closes; `null` when there is no active lease, and
 * `NaN` when its `notAfter` will not parse — callers must treat both as "nothing to wait for".
 */
export function leaseRemainingMs(
  state: CipherAccessStateView | null | undefined,
  nowMs: number,
): number | null {
  const lease = state?.activeLease;
  return lease == null ? null : Date.parse(lease.notAfter) - nowMs;
}
