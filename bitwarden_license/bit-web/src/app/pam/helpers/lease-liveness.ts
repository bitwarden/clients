import { concat, filter, Observable, of, switchMap, take } from "rxjs";

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

/**
 * `read$`'s state, read again once its lease's window closes on `ticks$`, since the lease may have
 * been extended without this surface hearing of it (PAM-152).
 */
export function rereadOnLapse<T extends CipherAccessStateView | null | undefined>(
  read$: () => Observable<T>,
  ticks$: Observable<number>,
): Observable<T> {
  const next$ = (): Observable<T> =>
    read$().pipe(
      switchMap((state) =>
        liveActiveLease(state, Date.now()) == null
          ? of(state)
          : concat(
              of(state),
              ticks$.pipe(
                filter((nowMs) => liveActiveLease(state, nowMs) == null),
                take(1),
                switchMap(next$),
              ),
            ),
      ),
    );
  return next$();
}
