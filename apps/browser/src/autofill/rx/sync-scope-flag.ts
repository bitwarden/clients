import { Observable, OperatorFunction, identity } from "rxjs";

// Captured at module load; substituted with a literal by the webpack DefinePlugin
// (see BW_DETECT_SYNC_BOUNDARIES in webpack.base.js) so a disabled guard tree-shakes
// to nothing and production builds pay no cost.
const DETECT_SYNC_BOUNDARIES = process.env.BW_DETECT_SYNC_BOUNDARIES;

/**
 * Brackets a pipeline region and reports when a value that entered through `enter`
 * reaches `exit` off the synchronous call stack that carried it in — i.e. something
 * between the two yielded to the event loop (a `Promise`, `setTimeout`, `timer()`,
 * `delay()`, `observeOn()`, etc).
 *
 * The check is a call-stack depth, not a timer: `enter` brackets its downstream push
 * with `depth++` / `depth--` (in a `try`/`finally`, so it rebalances even if a
 * downstream operator throws), and `exit` reports whenever it sees `depth === 0` —
 * i.e. it is not, right now, on the synchronous stack of any `enter`. A value
 * delivered asynchronously always arrives after every live `enter` call has already
 * returned and rebalanced `depth`, so it is reliably seen at depth 0 — no matter how
 * many other values entered and exited the same scope synchronously in between. (A
 * microtask-scheduled or per-value generation counter can be fooled by that
 * interleaving — a later synchronous value can reset shared state before an earlier
 * asynchronous one arrives; a call-stack depth cannot, because it is never touched
 * except while literally on that call stack.)
 *
 * Robust to fan-out and value drops: a dropped value (`filter`, `EMPTY`,
 * `switchMap`-cancel) never reaches `exit`, so it never triggers a check — no false
 * positive. Fan-out (`mergeMap`/`switchMap` emitting zero or more inner values) checks
 * each output against the stack independently.
 *
 * When `BW_DETECT_SYNC_BOUNDARIES` is unset, `enter`/`exit` are `identity` — a
 * disabled scope allocates no state and adds nothing to the stream.
 *
 * @param label - Identifies this scope in the reported message.
 * @param report - Receives the fully-formatted message on a crossing, e.g.
 *   `(message) => this.logService.warning(message)` or `console.warn` directly.
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
