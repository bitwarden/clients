import type { AccessLeaseView, CipherAccessStateView } from "../abstractions/access-lease";

/**
 * The caller's active lease over the cipher, or `undefined` once its window has closed.
 *
 * Nothing announces a lease running out: no mutation here, and on the server nothing happened at
 * all. So every surface on an open item reads the lease against a clock instead of waiting for an
 * event that never arrives (PM-41837). An unparseable `notAfter` counts as lapsed — this guards a
 * credential, so it fails closed.
 */
export function liveActiveLease(
  state: CipherAccessStateView | null | undefined,
  nowMs: number,
): AccessLeaseView | undefined {
  const lease = state?.activeLease;
  return lease != null && Date.parse(lease.notAfter) > nowMs ? lease : undefined;
}
