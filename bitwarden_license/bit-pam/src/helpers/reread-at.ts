import { EMPTY, expand, first, Observable, switchMap } from "rxjs";

/**
 * `read$`'s value, read again each time the moment `nextChangeMs` gives for it passes on `ticks$`,
 * since nothing announces a window or a lease ending. `undefined` schedules nothing. Each re-read
 * replaces the last, so the subscription stays one level deep however often it repeats.
 *
 * `read$` handles its own errors: one that errors ends the stream.
 */
export function rereadAt<T>(
  read$: () => Observable<T>,
  nextChangeMs: (value: T, nowMs: number) => number | undefined,
  ticks$: Observable<number>,
): Observable<T> {
  return read$().pipe(
    expand((value) => {
      const next = nextChangeMs(value, Date.now());
      return next === undefined
        ? EMPTY
        : ticks$.pipe(
            first((nowMs) => nowMs >= next),
            switchMap(() => read$()),
          );
    }),
  );
}
