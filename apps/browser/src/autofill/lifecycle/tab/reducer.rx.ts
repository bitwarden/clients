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
  tap,
  timeout,
} from "rxjs";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import type { UserId } from "@bitwarden/common/types/guid";

import { usingDisposable } from "../../rx/using-disposable";

import { TabSignalReducer } from "./reducer";
import type { ObservedWindow, ReducerSources, TabSignal } from "./types";

/**
 * Whether anyone is signed in, by the reduction that `lifecycle/design.md` defines for the login and
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
