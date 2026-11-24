import { Subject, Subscription } from "rxjs";

import { TabState } from "../enums";
import type { AutofillTimings, TabEdge } from "../types";

import { TabEvent, TabSignalKind } from "./enums";
import { tabLifecycle } from "./machine.rx";
import type { TabLifecycleEvent, TabSignal } from "./types";

/**
 * The lifecycle of every tab, as `lifecycle/design.md` describes it in "The tab lifecycle". It
 * runs one machine per tab on the signals it is given, and reports the machines' edges.
 *
 * A tab's machine is created on its first event, from `Frozen` or `Cold` according to whether
 * anyone is signed in, and ends with the tab. A tab that never activates never has one. The
 * machine emits no seed, so a consumer hears only the changes of state, and a tab that has had none
 * is in its initial state. A signal that reaches every tab, such as a logout, reaches them one at a
 * time.
 *
 * A signal for a tab must not follow the tab's removal, or it starts a machine that nothing ends.
 * The reducer applies signals in an order that keeps this true.
 */
export class TabLifecycles implements Disposable {
  private readonly machines = new Map<
    number,
    Readonly<{ events: Subject<TabLifecycleEvent>; subscription: Subscription }>
  >();
  private signedIn = false;
  private disposed = false;

  private readonly edgeReported = new Subject<readonly [number, TabEdge]>();
  private readonly tabRemoved = new Subject<number>();

  /** Each state change of each tab, with its tab's id. A tab's initial state is not a change. */
  readonly tabLifecycleChanged$ = this.edgeReported.asObservable();

  /**
   * The id of each tab that is removed. It ends the tab's machine, and nothing follows for the tab,
   * so it is also what ends anything else that holds the tab's state.
   */
  readonly tabRemoved$ = this.tabRemoved.asObservable();

  constructor(private readonly timings: Pick<AutofillTimings, "settleMs$" | "coolDownMs$">) {}

  /** Applies a signal. Nothing follows once the lifecycles are disposed. */
  apply(signal: TabSignal): void {
    if (this.disposed) {
      return;
    }
    switch (signal.kind) {
      case TabSignalKind.Tab:
        this.signedIn = signal.signedIn;
        this.machine(signal.tabId).next(signal.event);
        break;

      case TabSignalKind.All:
        this.signedIn = signal.signedIn;
        for (const { events } of [...this.machines.values()]) {
          events.next(signal.event);
        }
        break;

      case TabSignalKind.Removed:
        this.machines.get(signal.tabId)?.subscription.unsubscribe();
        this.machines.delete(signal.tabId);
        this.tabRemoved.next(signal.tabId);
        break;
    }
  }

  /**
   * Notifies the tab lifecycle that the user initiated a fill command targeting
   * its content.
   */
  command(tabId: number): void {
    if (this.disposed) {
      return;
    }
    this.machines.get(tabId)?.events.next({ kind: TabEvent.Command });
  }

  [Symbol.dispose](): void {
    this.disposed = true;
    for (const { subscription } of this.machines.values()) {
      subscription.unsubscribe();
    }
    this.machines.clear();
    this.edgeReported.complete();
    this.tabRemoved.complete();
  }

  private machine(tabId: number): Subject<TabLifecycleEvent> {
    const existing = this.machines.get(tabId);
    if (existing) {
      return existing.events;
    }

    const events = new Subject<TabLifecycleEvent>();
    const seed = this.signedIn ? TabState.Cold : TabState.Frozen;
    const subscription = events.pipe(tabLifecycle(seed, this.timings)).subscribe((edge) => {
      this.edgeReported.next([tabId, edge]);
    });
    this.machines.set(tabId, { events, subscription });
    return events;
  }
}
