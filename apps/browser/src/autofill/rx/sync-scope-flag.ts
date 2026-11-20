import { Observable, OperatorFunction, identity } from "rxjs";

// Captured at module load; substituted with a literal by the webpack DefinePlugin
// (see BW_DETECT_SYNC_BOUNDARIES in webpack.base.js) so a disabled guard tree-shakes
// to nothing and production builds pay no cost.
const DETECT_SYNC_BOUNDARIES = process.env.BW_DETECT_SYNC_BOUNDARIES;

/**
 * Guards a pipeline region that must stay synchronous. Returns a matched
 * `{ enter, exit }` pair of operators: pipe `enter` at the start of the region and
 * `exit` at the end — `source.pipe(enter, ...region..., exit)`. If a value that went
 * in through `enter` only reaches `exit` after the region has yielded to the event
 * loop — a `Promise`, `setTimeout`, `timer()`, `delay()`, `observeOn()`, or any other
 * async hop in between — `report` is called with a message naming the scope and the
 * likely culprits.
 *
 * This is a diagnostic for development and CI, not a runtime assertion: it never
 * throws and never alters the values flowing through — it only reports.
 *
 * Behavior a caller can rely on:
 * - A value dropped before `exit` (`filter`, `EMPTY`, a cancelled `switchMap` inner)
 *   never triggers a report, so there are no false positives from short-circuiting.
 * - Fan-out is handled per value: an operator emitting many outputs has each checked
 *   on its own.
 * - `enter` and `exit` share state, so both must come from the same call; using one
 *   without the other does nothing. The message pinpoints the scope by `label`, not
 *   the exact operator that introduced the boundary.
 *
 * Unless the `BW_DETECT_SYNC_BOUNDARIES` build flag is set, `enter` and `exit` are the
 * identity operator: the guard adds nothing to the stream and costs nothing, so
 * production builds neither report nor pay for it.
 *
 * @param label - Identifies this scope in the reported message.
 * @param report - Receives the message when a value crosses an asynchronous boundary,
 *   e.g. `(message) => this.logService.warning(message)`.
 */
export function assertSynchronousScope(
  label: string,
  report: (message: string) => void,
): {
  enter: <T>(source: Observable<T>) => Observable<T>;
  exit: <T>(source: Observable<T>) => Observable<T>;
} {
  if (!DETECT_SYNC_BOUNDARIES) {
    return { enter: identity, exit: identity };
  }

  // Depth of `enter` emissions currently propagating synchronously downstream. > 0
  // means "on the synchronous stack of an enter"; it returns to 0 the instant control
  // unwinds past every enter's next() call — i.e. whenever the scope has yielded to
  // the event loop. Shared by enter/exit through this closure.
  let depth = 0;

  const enter = <T>(source: Observable<T>): Observable<T> =>
    new Observable<T>((subscriber) =>
      source.subscribe({
        next: (value) => {
          depth++;
          // Bracket the synchronous reach of exactly this emission. Balanced by
          // try/finally regardless of downstream drops, fan-out, or throws.
          try {
            subscriber.next(value);
          } finally {
            depth--;
          }
        },
        error: (error: unknown) => subscriber.error(error),
        complete: () => subscriber.complete(),
      }),
    );

  const exit = <T>(source: Observable<T>): Observable<T> =>
    new Observable<T>((subscriber) =>
      source.subscribe({
        next: (value) => {
          // Reached exit while not on any enter's synchronous stack — the scope
          // yielded to the event loop between enter and here.
          if (depth === 0) {
            report(
              `[assertSynchronousScope] "${label}" observed a value cross an asynchronous ` +
                "boundary. The bracketed region must stay synchronous — check for a Promise, " +
                "setTimeout, timer(), delay(), or observeOn() between enter and exit.",
            );
          }
          subscriber.next(value);
        },
        error: (error: unknown) => subscriber.error(error),
        complete: () => subscriber.complete(),
      }),
    );

  return { enter, exit };
}

/**
 * Brackets a single operator with {@link assertSynchronousScope}. Equivalent to
 * `source.pipe(enter, op, exit)`, for the common case of guarding one operator (e.g.
 * a `scan` fold) rather than a multi-stage region.
 *
 * When `BW_DETECT_SYNC_BOUNDARIES` is unset, returns `op` untouched.
 *
 * @param label - Identifies this scope in the reported message.
 * @param op - The operator to guard.
 * @param report - Receives the fully-formatted message on a crossing.
 */
export function assertSynchronous<T, R>(
  label: string,
  op: OperatorFunction<T, R>,
  report: (message: string) => void,
): OperatorFunction<T, R> {
  if (!DETECT_SYNC_BOUNDARIES) {
    return op;
  }

  return (source) => {
    const { enter, exit } = assertSynchronousScope(label, report);
    return source.pipe(enter, op, exit);
  };
}
