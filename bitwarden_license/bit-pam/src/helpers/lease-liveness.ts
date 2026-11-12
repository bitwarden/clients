import { Observable } from "rxjs";

import type { AccessLeaseView, CipherAccessStateView } from "../abstractions/access-lease";

import { rereadAt } from "./reread-at";

/** Whether the lease's window is still open. An unparseable `notAfter` counts as lapsed, failing closed. */
export function isLeaseLive(lease: Pick<AccessLeaseView, "notAfter">, nowMs: number): boolean {
  return Date.parse(lease.notAfter) > nowMs;
}

/**
 * The active lease, or `undefined` once its window has closed, since nothing announces a lease
 * running out.
 */
export function liveActiveLease(
  state: CipherAccessStateView | null | undefined,
  nowMs: number,
): AccessLeaseView | undefined {
  const lease = state?.activeLease;
  return lease != null && isLeaseLive(lease, nowMs) ? lease : undefined;
}

/**
 * `read$`'s state, read again once its lease lapses on `ticks$`, since the lease may have been
 * extended without this surface hearing of it.
 */
export function rereadOnLapse<T extends CipherAccessStateView | null | undefined>(
  read$: () => Observable<T>,
  ticks$: Observable<number>,
): Observable<T> {
  return rereadAt(
    read$,
    (state, nowMs) => {
      const lease = liveActiveLease(state, nowMs);
      return lease == null ? undefined : Date.parse(lease.notAfter);
    },
    ticks$,
  );
}
