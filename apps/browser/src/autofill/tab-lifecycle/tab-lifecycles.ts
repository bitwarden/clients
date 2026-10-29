import {
  BehaviorSubject,
  ignoreElements,
  Observable,
  ReplaySubject,
  Subject,
  Subscription,
  tap,
} from "rxjs";

import { TabState } from "./enums";
import { tabSignals$, type ReducerSources, type TabSignal } from "./reducer";
import { tabLifecycle } from "./rx";
import type { AutofillTimings } from "./timings";
import type { TabEdge, TabLifecycleEvent } from "./types";

/**
 * The lifecycle of every tab, as `lifecycle.design.md` describes it in "The tab lifecycle". It
 * runs one machine per tab on the signals it is given, and reports the machines' edges.
 *
 * A tab's machine is created on its first event, from `Frozen` or `Cold` according to whether
 * anyone is signed in, and ends with the tab. A tab that never activates never has one. The
 * machine emits no seed, so a consumer that needs a tab's state reads {@link latestEdges$}.
 *
 * Every consumer is told of a change after the state it reads has changed: a consumer that joins
 * {@link latestEdges$} as an edge arrives reads a map that includes the edge. A signal that reaches
 * every tab, such as a logout, reaches them one at a time, so a consumer hearing of one tab's edge
 * may still read another tab as it was before the signal.
 *
 * A signal for a tab must not follow the tab's removal, or it starts a machine that nothing ends.
 * The reducer applies signals in an order that keeps this true.
 */
export class TabLifecycles implements Disposable {
  private readonly machines = new Map<
    number,
    Readonly<{ events: Subject<TabLifecycleEvent>; subscription: Subscription }>
  >();
  private readonly latest = new Map<number, TabEdge>();
  private signedIn = false;
  private disposed = false;

  private readonly edgeReported = new Subject<readonly [number, TabEdge]>();
  private readonly tabRemoved = new Subject<number>();
  private readonly latestEdgesChanged = new BehaviorSubject<ReadonlyMap<number, TabEdge>>(
    this.latest,
  );
  private readonly seeded = new ReplaySubject<void>(1);

  /** Each state change of each tab, with its tab's id. A tab's initial state is not a change. */
  readonly tabLifecycleChanged$ = this.edgeReported.asObservable();

  /**
   * The id of each tab that is removed. It ends the tab's machine, and nothing follows for the tab,
   * so it is also what ends anything else that holds the tab's state.
   */
  readonly tabRemoved$ = this.tabRemoved.asObservable();

  /**
   * The latest edge of each tab that has had one, for joining at the arrival of an event. It is one
   * map, updated in place: read it when joining, and never compare two of its emissions. A tab with
   * no entry has not changed state since the lifecycles began, which is `Frozen` or `Cold`
   * according to whether anyone is signed in; a removed tab has none.
   */
  readonly latestEdges$ = this.latestEdgesChanged.asObservable();

  /**
   * Emits once the browser's windows have been read and every window's active tab announced, or
   * once that has failed. Neither starts until the accounts have been observed once. A tab the seed could not resolve has no state until the browser
   * activates it.
   */
  readonly ready$ = this.seeded.asObservable();

  constructor(private readonly timings: Pick<AutofillTimings, "settleMs$" | "coolDownMs$">) {}

  /** Applies a signal. Nothing follows once the lifecycles are disposed. */
  apply(signal: TabSignal): void {
    if (this.disposed) {
      return;
    }
    switch (signal.kind) {
      case "tab":
        this.signedIn = signal.signedIn;
        this.machine(signal.tabId).next(signal.event);
        break;

      case "all":
        this.signedIn = signal.signedIn;
        for (const { events } of [...this.machines.values()]) {
          events.next(signal.event);
        }
        break;

      case "removed":
        this.machines.get(signal.tabId)?.subscription.unsubscribe();
        this.machines.delete(signal.tabId);
        this.latest.delete(signal.tabId);
        this.tabRemoved.next(signal.tabId);
        break;

      case "seeded":
        this.seeded.next();
        break;
    }
  }

  [Symbol.dispose](): void {
    this.disposed = true;
    for (const { subscription } of this.machines.values()) {
      subscription.unsubscribe();
    }
    this.machines.clear();
    this.edgeReported.complete();
    this.tabRemoved.complete();
    this.latestEdgesChanged.complete();
    this.seeded.complete();
  }

  private machine(tabId: number): Subject<TabLifecycleEvent> {
    const existing = this.machines.get(tabId);
    if (existing) {
      return existing.events;
    }

    const events = new Subject<TabLifecycleEvent>();
    const seed = this.signedIn ? TabState.Cold : TabState.Frozen;
    const subscription = events.pipe(tabLifecycle(seed, this.timings)).subscribe((edge) => {
      this.latest.set(tabId, edge);
      this.edgeReported.next([tabId, edge]);
    });
    this.machines.set(tabId, { events, subscription });
    return events;
  }
}

/**
 * Feeds {@link TabLifecycles} from the browser's signals. Subscribe to run; it emits nothing.
 *
 * Subscribe to the lifecycles' streams first: they do not replay what they missed, apart from
 * `latestEdges$` and `ready$`.
 */
export function feedTabLifecycles(
  lifecycles: TabLifecycles,
  sources: ReducerSources,
): Observable<never> {
  return tabSignals$(sources).pipe(
    tap<TabSignal>((signal) => lifecycles.apply(signal)),
    ignoreElements(),
  );
}
