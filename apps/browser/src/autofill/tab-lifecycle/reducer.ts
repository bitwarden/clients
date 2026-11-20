import {
  catchError,
  concatMap,
  connect,
  defer,
  distinctUntilChanged,
  EMPTY,
  first,
  from,
  ignoreElements,
  map,
  merge,
  mergeMap,
  Observable,
  of,
  Subject,
  tap,
  timeout,
} from "rxjs";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import type { UserId } from "@bitwarden/common/types/guid";

import { usingDisposable } from "../rx/using-disposable";

import type { TabLifecycleEvent } from "./types";

/** The window and its tabs, as the browser reports them. `chrome.windows.Window` satisfies it. */
export type ObservedWindow = Readonly<{
  id?: number;
  focused: boolean;
  /** Present when the browser is asked to populate the window; a window without them has no active tab. */
  tabs?: ReadonlyArray<Readonly<{ id?: number; active: boolean }>>;
}>;

/** What {@link feedTabSignalReducer} reads. Every stream is subscribed once. */
export type ReducerSources = Readonly<{
  /** Whether anyone is signed in. See {@link signedIn}. */
  signedIn$: Observable<boolean>;
  tabActivated$: Observable<Readonly<{ tabId: number; windowId: number }>>;
  tabCreated$: Observable<Readonly<{ id?: number; windowId: number; active: boolean }>>;
  tabRemoved$: Observable<Readonly<{ tabId: number }>>;
  tabReplaced$: Observable<Readonly<{ removedTabId: number }>>;
  tabAttached$: Observable<Readonly<{ tabId: number }>>;
  tabDetached$: Observable<Readonly<{ tabId: number; oldWindowId: number }>>;
  /** The newly focused window's id, or `-1` for none. */
  windowFocusChanged$: Observable<number>;
  windowRemoved$: Observable<number>;
  /** Every window with its tabs: the browser's answer to what the signals above leave unclear. */
  getWindows: () => Promise<readonly ObservedWindow[]>;
  /** Called when `getWindows` fails. The reconciliation yields no events and the facts stand. */
  onReconcileError: (error: unknown) => void;
}>;

/** What the reducer delivers, in the order it is meant to be applied. */
export type TabSignal =
  /** An event for one tab. `signedIn` is the extension's state when it was derived. */
  | Readonly<{ kind: "tab"; tabId: number; event: TabLifecycleEvent; signedIn: boolean }>
  | Readonly<{
      kind: "all";
      event: Extract<TabLifecycleEvent, { kind: "login" | "logout" }>;
      signedIn: boolean;
    }>
  /** The tab does not exist. Nothing follows for it. */
  | Readonly<{ kind: "removed"; tabId: number }>
  /** The first reconciliation with the browser is complete, however it ended. */
  | Readonly<{ kind: "seeded" }>;

/**
 * Whether anyone is signed in, by the reduction that `lifecycle.design.md` defines for the login and
 * logout events. Emits only when that changes.
 */
export function signedIn(
  statuses$: Observable<Record<UserId, AuthenticationStatus>>,
): Observable<boolean> {
  return statuses$.pipe(
    map((statuses) => Object.values(statuses).some((s) => s !== AuthenticationStatus.LoggedOut)),
    distinctUntilChanged(),
  );
}

/**
 * What the reducer holds: each window's active tab, and the focused window. Every tab event other
 * than login and logout is a difference between these facts before and after a signal. A window
 * with no active tab is known but empty.
 */
type Facts = Readonly<{
  windows: ReadonlyMap<number, number | undefined>;
  focusedWindow: number | undefined;
}>;

const WINDOW_ID_NONE = -1;

/** Each window's active tab, mapped to whether its window is focused. */
function activeTabs(facts: Facts): Map<number, boolean> {
  const active = new Map<number, boolean>();
  for (const [windowId, tabId] of facts.windows) {
    if (tabId !== undefined) {
      active.set(tabId, windowId === facts.focusedWindow);
    }
  }
  return active;
}

function factsFrom(windows: readonly ObservedWindow[]): Facts {
  const active = new Map<number, number | undefined>();
  let focusedWindow: number | undefined;
  for (const window of windows) {
    if (window.id === undefined) {
      continue;
    }
    active.set(window.id, window.tabs?.find((tab) => tab.active)?.id);
    if (window.focused) {
      focusedWindow = window.id;
    }
  }
  return { windows: active, focusedWindow };
}

/**
 * The tab events that take `before` to `after`: deactivate and blur, then activate and focus. A tab
 * that becomes active carries its focus in its activation, so it gets no separate focus.
 */
function diff(
  before: Facts,
  after: Facts,
  signedIn: boolean,
): Extract<TabSignal, { kind: "tab" }>[] {
  const was = activeTabs(before);
  const is = activeTabs(after);
  const signal = (tabId: number, event: TabLifecycleEvent) =>
    ({ kind: "tab", tabId, event, signedIn }) as const;

  const signals = [];
  for (const [tabId, focused] of was) {
    if (!is.has(tabId)) {
      signals.push(signal(tabId, { kind: "deactivate" }));
    } else if (focused && !is.get(tabId)) {
      signals.push(signal(tabId, { kind: "blur" }));
    }
  }
  for (const [tabId, focused] of is) {
    if (!was.has(tabId)) {
      signals.push(signal(tabId, { kind: "activate", focused }));
    } else if (focused && !was.get(tabId)) {
      signals.push(signal(tabId, { kind: "focus" }));
    }
  }
  return signals;
}

/**
 * Reduces the browser's tab, window and account signals to the events the tab-lifecycle machine
 * takes, as `lifecycle.design.md` defines them under "Event transitions", including the rules of
 * delivery.
 *
 * Every method takes one signal and reports what follows from it on {@link signals$}. A method
 * that returns `false` could not interpret its signal, or all of it, against what the reducer
 * holds, and has reported nothing for what it could not interpret: the caller reads the browser's windows and passes them to
 * {@link TabSignalReducer.reconciled}, or says it could not with {@link TabSignalReducer.reconcileFailed}.
 */
export class TabSignalReducer implements Disposable {
  private facts: Facts = { windows: new Map(), focusedWindow: undefined };
  private signedIn: boolean | undefined;
  private seeding = false;
  private readonly reported = new Subject<TabSignal>();

  /** What follows from each signal, in the order it is to be applied. */
  readonly signals$ = this.reported.asObservable();

  /**
   * The accounts' state. The first observation sets what every tab event is stamped with, and
   * delivers neither `login` nor `logout`. Each crossing after it delivers one of them to every
   * tab.
   */
  accountChanged(signedIn: boolean): boolean {
    if (signedIn === this.signedIn) {
      return true;
    }
    const initial = this.signedIn === undefined;
    this.signedIn = signedIn;
    if (initial) {
      return true;
    }

    this.reported.next({ kind: "all", event: { kind: signedIn ? "login" : "logout" }, signedIn });
    if (signedIn) {
      // Signing in says nothing about which tab the user is looking at, so every window's active
      // tab is announced again for the machine to promote.
      for (const [tabId, focused] of activeTabs(this.facts)) {
        this.reported.next({ kind: "tab", tabId, event: { kind: "activate", focused }, signedIn });
      }
    }
    return true;
  }

  /**
   * Starts the seed: every window's active tab is announced once the browser's windows are
   * {@link TabSignalReducer.reconciled}, or the attempt has failed.
   */
  seed(): boolean {
    this.seeding = true;
    return false;
  }

  /** Takes the browser's windows as the facts, and reports what differs from the facts held. */
  reconciled(windows: readonly ObservedWindow[]): void {
    this.apply(factsFrom(windows));
    this.finishSeed();
  }

  /** The browser's windows could not be read. The facts stand. */
  reconcileFailed(): void {
    this.finishSeed();
  }

  tabActivated(tabId: number, windowId: number): boolean {
    // A window the reducer has not heard of might hold tabs it has not heard of either.
    if (!this.facts.windows.has(windowId)) {
      return false;
    }
    this.activate(windowId, tabId);
    return true;
  }

  /** A tab without an id cannot be tracked, so it is not reported. */
  tabCreated(tab: Readonly<{ id?: number; windowId: number; active: boolean }>): boolean {
    // A tab created active need not be followed by an activation, and the window it was created
    // in may be new. The tab's own window and activity are all there is to learn.
    if (tab.active && tab.id !== undefined) {
      this.activate(tab.windowId, tab.id);
    }
    return true;
  }

  /**
   * The browser reports a replaced tab as replaced, not removed. The replaced tab is gone, and the
   * browser does not say whether its replacement is its window's active tab.
   */
  tabReplaced(removedTabId: number): boolean {
    this.tabRemoved(removedTabId);
    return false;
  }

  /** The browser does not say whether a tab landed as its window's active tab. */
  tabAttached(): boolean {
    return false;
  }

  tabDetached(tabId: number, oldWindowId: number): boolean {
    // A tab detached from a window it was not active in changes nothing the reducer holds.
    if (this.facts.windows.get(oldWindowId) === tabId) {
      this.apply({ ...this.facts, windows: this.withWindow(oldWindowId, undefined) });
    }
    return true;
  }

  tabRemoved(tabId: number): boolean {
    // The tab is not its window's active tab, and it is not deactivated: its removal ends its
    // machine. Its window waits for the tab the browser activates in its place.
    const windows = new Map(this.facts.windows);
    for (const [windowId, activeTabId] of windows) {
      if (activeTabId === tabId) {
        windows.set(windowId, undefined);
      }
    }
    this.facts = { ...this.facts, windows };
    this.reported.next({ kind: "removed", tabId });
    return true;
  }

  windowFocusChanged(windowId: number): boolean {
    if (windowId === WINDOW_ID_NONE || !this.facts.windows.has(windowId)) {
      return false;
    }
    this.apply({ ...this.facts, focusedWindow: windowId });
    return true;
  }

  windowRemoved(windowId: number): boolean {
    const windows = new Map(this.facts.windows);
    windows.delete(windowId);
    // Its tabs are reported removed, and the browser reports the focus it moves to.
    this.apply({
      windows,
      focusedWindow: this.facts.focusedWindow === windowId ? undefined : this.facts.focusedWindow,
    });
    return true;
  }

  [Symbol.dispose](): void {
    this.reported.complete();
  }

  private activate(windowId: number, tabId: number): void {
    this.apply({ ...this.facts, windows: this.withWindow(windowId, tabId) });
  }

  private withWindow(windowId: number, tabId: number | undefined) {
    return new Map(this.facts.windows).set(windowId, tabId);
  }

  private apply(next: Facts): void {
    // Tab events are derived only after the first account observation, which sets `signedIn`.
    // The facts are committed before anything is reported, so what hears of a signal reads them
    // as they are after it.
    const signals = diff(this.facts, next, this.signedIn ?? false);
    this.facts = next;
    for (const signal of signals) {
      this.reported.next(signal);
    }
  }

  private finishSeed(): void {
    if (this.seeding) {
      this.seeding = false;
      this.reported.next({ kind: "seeded" });
    }
  }
}

/**
 * How long the browser has to answer `getWindows`. Signals wait behind a reconciliation, so a logout
 * must not wait on a browser that never answers. A bound on safety, not a tuned value.
 */
const RECONCILE_TIMEOUT_MS = 5000;

/**
 * Feeds a reducer from its sources. Subscribe to run; it emits nothing.
 *
 * It starts when the first account observation arrives, so no tab is announced before the extension
 * knows whether anyone is signed in. What the browser did in the meantime is in what the seed
 * reads. The browser's signals are applied in the order they arrive, a reconciliation included: one
 * that waits on the browser holds the signals behind it. An account change does not wait.
 */
export function feedTabSignalReducer(
  reducer: TabSignalReducer,
  sources: ReducerSources,
): Observable<never> {
  // Each source becomes a step the reducer takes. `false` says the reducer needs the browser.
  const step = <T>(source$: Observable<T>, take: (value: T) => boolean) =>
    source$.pipe(map((value) => () => take(value)));

  const browser$ = merge(
    of(() => reducer.seed()),
    step(sources.tabActivated$, (e) => reducer.tabActivated(e.tabId, e.windowId)),
    step(sources.tabCreated$, (tab) => reducer.tabCreated(tab)),
    step(sources.tabRemoved$, (e) => reducer.tabRemoved(e.tabId)),
    step(sources.tabReplaced$, (e) => reducer.tabReplaced(e.removedTabId)),
    step(sources.tabAttached$, () => reducer.tabAttached()),
    step(sources.tabDetached$, (e) => reducer.tabDetached(e.tabId, e.oldWindowId)),
    step(sources.windowFocusChanged$, (windowId) => reducer.windowFocusChanged(windowId)),
    step(sources.windowRemoved$, (windowId) => reducer.windowRemoved(windowId)),
  );

  // Unsubscribing ends the wait and its timeout. A query still in flight is ignored.
  const reconcile$ = defer(() => from(sources.getWindows())).pipe(
    timeout(RECONCILE_TIMEOUT_MS),
    catchError((error: unknown) => {
      sources.onReconcileError(error);
      return of(undefined);
    }),
    tap<readonly ObservedWindow[] | undefined>((windows) =>
      windows ? reducer.reconciled(windows) : reducer.reconcileFailed(),
    ),
    ignoreElements(),
  );

  return step(sources.signedIn$, (signedIn) => reducer.accountChanged(signedIn)).pipe(
    connect((account$) =>
      merge(
        // The accounts do not wait on the browser: a logout must not be held behind a query.
        account$.pipe(
          tap<() => boolean>((take) => take()),
          ignoreElements(),
        ),
        account$.pipe(
          first(),
          mergeMap(() => browser$),
          concatMap((take) => (take() ? EMPTY : reconcile$)),
        ),
      ),
    ),
    ignoreElements(),
  );
}

/**
 * A {@link TabSignalReducer}, fed from its sources.
 *
 * Each subscription holds its own reducer and subscribes to every source.
 */
export function tabSignals$(sources: ReducerSources): Observable<TabSignal> {
  return usingDisposable(
    () => new TabSignalReducer(),
    (reducer) => merge(reducer.signals$, feedTabSignalReducer(reducer, sources)),
  );
}
