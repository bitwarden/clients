import {
  concat,
  distinctUntilChanged,
  map,
  Observable,
  of,
  OperatorFunction,
  pairwise,
  startWith,
  switchScan,
  timer,
} from "rxjs";

import { TabEdgeCause, TabState } from "./enums";
import { transition } from "./machine";
import type { MachineContext, TabEdge, TabLifecycleEvent } from "./types";

/** The settle debounce: how long a just-activated tab waits before committing to monitoring. */
export const SETTLE_MS = 500;

/** The cool-down grace: how long a just-left hot tab keeps monitoring before standing down. */
export const COOL_DOWN_MS = 15_000;

/**
 * `transition` (`./machine.ts`) extended with the timed exits out of `WarmUp` and `CoolDown`. Each
 * emits the state it enters, then the state it times out into.
 */
function step(ctx: MachineContext, event: TabLifecycleEvent): Observable<MachineContext> {
  const next = transition(ctx, event);
  // `switchScan` unsubscribes this inner on every subsequent event, which is the timer cancellation
  // the machine wants: a return inside the grace, a deactivate mid-settle, a logout. It also means
  // nothing here protects a running timer — the guard below only decides whether to arm a new one.
  //
  // A real transition back into a timed state therefore re-arms it, so a focus or blur mid-warm-up
  // pushes the settle out a full SETTLE_MS from that event. Benign: it re-debounces, and never
  // yields an early or wrong Hot. A no-op returns the same reference and arms nothing, which is why
  // `tabLifecycle` requires deduplicated input — a redundant event in a timed state would
  // cancel its timer and leave the tab there.
  if (next !== ctx && next.state === TabState.WarmUp) {
    const settled: MachineContext = next.focused
      ? { state: TabState.Hot, focused: true, cause: TabEdgeCause.Settle }
      : { state: TabState.Warm, focused: false, cause: TabEdgeCause.Settle };
    return concat(of(next), timer(SETTLE_MS).pipe(map(() => settled)));
  }
  if (next !== ctx && next.state === TabState.CoolDown) {
    const cooled: MachineContext = {
      state: TabState.Cold,
      focused: next.focused,
      cause: TabEdgeCause.CoolDownElapsed,
    };
    return concat(of(next), timer(COOL_DOWN_MS).pipe(map(() => cooled)));
  }
  return of(next);
}

/**
 * The per-tab lifecycle operator: a stream of {@link TabLifecycleEvent}s in, classified
 * {@link TabEdge}s out. Self-edges (a focus refresh that does not change the state) are suppressed,
 * so every emission is a genuine falling/leading-edge pair.
 *
 * Runs one tab. Compose under `groupBy(tabId)` + `takeUntil(tabRemoved$)` for the whole surface.
 *
 * The source must be **deduplicated** — one event per genuine change in the tab's active, focused,
 * or auth facts. A redundant event arriving while a tab is settling or cooling down cancels that
 * tab's pending timer without replacing it, leaving the tab stranded in a state it never exits. A
 * producer that cannot guarantee uniqueness must diff its facts before mapping them to events.
 *
 * @param seed - the tab's initial state: `Frozen` for a tab opened while logged out, `Cold` for one
 *   opened while logged in.
 */
export function tabLifecycle(
  seed: TabState = TabState.Frozen,
): OperatorFunction<TabLifecycleEvent, TabEdge> {
  const initial: MachineContext = { state: seed, focused: false, cause: TabEdgeCause.Login };
  return (events$) =>
    events$.pipe(
      switchScan(step, initial),
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
}
