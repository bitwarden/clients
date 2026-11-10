import {
  concat,
  defer,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  of,
  OperatorFunction,
  pairwise,
  startWith,
  switchScan,
  tap,
} from "rxjs";

import { TabEdgeCause, TabState } from "./enums";
import { transition } from "./machine";
import { waitFor, type AutofillTimings } from "./timings";
import type { MachineContext, TabEdge, TabLifecycleEvent } from "./types";

type Waits = Pick<AutofillTimings, "settleMs$" | "coolDownMs$">;

/**
 * Steps the machine described in `lifecycle.design.md` by one event, including its timed exits.
 */
function step(
  waits: Waits,
  ctx: MachineContext,
  event: TabLifecycleEvent,
): Observable<MachineContext> {
  const next = transition(ctx, event);
  // `switchScan` unsubscribes this inner on every subsequent event, which cancels a pending wait.
  if (next !== ctx && next.state === TabState.WarmUp) {
    const settled: MachineContext = next.focused
      ? { state: TabState.Hot, focused: true, cause: TabEdgeCause.Settle }
      : { state: TabState.Warm, focused: false, cause: TabEdgeCause.Settle };
    return concat(of(next), of(settled).pipe(waitFor(waits.settleMs$)));
  }
  if (next !== ctx && next.state === TabState.CoolDown) {
    const cooled: MachineContext = {
      state: TabState.Cold,
      focused: next.focused,
      cause: TabEdgeCause.CoolDownElapsed,
    };
    return concat(of(next), of(cooled).pipe(waitFor(waits.coolDownMs$)));
  }
  return of(next);
}

/**
 * The lifecycle of one tab, as `lifecycle.design.md` describes it: events in, state changes out.
 * The seed is not emitted. It runs one tab; `TabLifecycles` runs every tab.
 *
 * Events that change nothing are dropped. The source should still deliver one event per genuine
 * change, addressed only to the tabs it concerns.
 *
 * @param seed - `Frozen` for a tab opened while logged out, `Cold` for one opened while logged in.
 * @param timings - see {@link AutofillTimings}.
 */
export function tabLifecycle(
  seed: TabState,
  timings: Waits,
): OperatorFunction<TabLifecycleEvent, TabEdge> {
  const initial: MachineContext = { state: seed, focused: false, cause: TabEdgeCause.Login };
  return (events$) =>
    defer(() => {
      let latest = initial;
      return events$.pipe(
        filter((event) => transition(latest, event) !== latest),
        switchScan((ctx, event) => step(timings, ctx, event), initial),
        tap((ctx) => (latest = ctx)),
        startWith(initial),
        distinctUntilChanged((a, b) => a.state === b.state),
        pairwise(),
        map(([prev, next]) => ({
          from: prev.state,
          to: next.state,
          cause: next.cause,
          focused: next.focused,
        })),
      );
    });
}
