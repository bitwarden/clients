import { concat, filter, Observable, of, switchMap, take } from "rxjs";

import type { AccessLeaseView, CipherAccessStateView } from "../abstractions/access-lease";

/**
 * The active lease, or `undefined` once its window has closed, since nothing announces a lease
 * running out. An unparseable `notAfter` counts as lapsed, failing closed.
 */
export function liveActiveLease(
  state: CipherAccessStateView | null | undefined,
  nowMs: number,
): AccessLeaseView | undefined {
  const lease = state?.activeLease;
  return lease != null && Date.parse(lease.notAfter) > nowMs ? lease : undefined;
}

/**
 * `read$`'s state, read again once its lease lapses on `ticks$`, since the lease may have been
 * extended without this surface hearing of it.
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
