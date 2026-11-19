import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subject,
  Subscription,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  exhaustMap,
  filter,
  from,
  fromEvent,
  interval,
  map,
  merge,
  of,
  switchMap,
} from "rxjs";

import { PamConnectivityService } from "@bitwarden/bit-pam";

/**
 * How long a change in reachability must hold before the UI follows it, so a brief blip neither
 * shows the offline banner nor disables the actions.
 */
export const PAM_OFFLINE_DEBOUNCE_MS = 2_000;

/**
 * How often, while the device has a network but the server last failed to answer, a background
 * read checks whether it answers again. Only a read: a user action is never retried.
 */
export const PAM_RECONNECT_PROBE_INTERVAL_MS = 30_000;

/** What the service reads off the renderer's window: the browser's own online flag and events. */
export type PamConnectivityWindow = Pick<Window, "addEventListener" | "removeEventListener"> & {
  readonly navigator: Pick<Navigator, "onLine">;
};

/** How the PAM call guard reports each call's outcome. */
export interface PamCallOutcomeReporter {
  /** A call got an answer from the server, success or refusal. */
  reportReachable(): void;
  /** A call failed in transport or got no answer in time. */
  reportUnreachable(): void;
  /** The browser reports no network right now, so any failure is a network failure. */
  readonly browserOffline: boolean;
}

/**
 * Whether the desktop renderer can reach the server for PAM, from three signals:
 *
 * - the browser's `navigator.onLine` and its `online` and `offline` events (no network at all);
 * - evidence the server answered: a server push on `serverActivity$` (any notification), a
 *   successful sync, or a PAM call that got an answer, success or refusal, each of which clears an
 *   unreachable server;
 * - PAM call failures: a transport failure or a timeout marks the server unreachable.
 *
 * An `online` event also clears an unreachable server, so the next call decides afresh.
 * {@link offline$} follows those signals only once they have held for {@link PAM_OFFLINE_DEBOUNCE_MS}.
 * A root singleton for the renderer's lifetime, so its subscriptions never end.
 */
export class DesktopPamConnectivityService
  extends PamConnectivityService
  implements PamCallOutcomeReporter
{
  private readonly browserOnline$: BehaviorSubject<boolean>;
  private readonly serverUnreachable$ = new BehaviorSubject<boolean>(false);
  private readonly settled$: BehaviorSubject<boolean>;
  private readonly reconnectedSubject$ = new Subject<void>();

  readonly offline$: Observable<boolean>;
  readonly reconnected$: Observable<void> = this.reconnectedSubject$.asObservable();

  /**
   * Ticks every {@link PAM_RECONNECT_PROBE_INTERVAL_MS} while the device has a network but the
   * server is marked unreachable, so a read can find out whether it answers again.
   */
  readonly probeDue$: Observable<void>;

  constructor(
    win: PamConnectivityWindow,
    serverActivity$: Observable<unknown>,
    syncCompleted$: Observable<{ successfully?: boolean }>,
  ) {
    super();
    this.browserOnline$ = new BehaviorSubject<boolean>(win.navigator.onLine !== false);
    this.settled$ = new BehaviorSubject<boolean>(this.rawOffline());
    this.offline$ = this.settled$.pipe(distinctUntilChanged());

    fromEvent(win, "online").subscribe(() => {
      this.serverUnreachable$.next(false);
      this.browserOnline$.next(true);
    });
    fromEvent(win, "offline").subscribe(() => this.browserOnline$.next(false));

    merge(serverActivity$, syncCompleted$.pipe(filter((sync) => sync?.successfully === true)))
      .pipe(filter(() => this.serverUnreachable$.value))
      .subscribe(() => this.reportReachable());

    combineLatest([this.browserOnline$, this.serverUnreachable$])
      .pipe(
        map(([online, unreachable]) => !online || unreachable),
        distinctUntilChanged(),
        debounceTime(PAM_OFFLINE_DEBOUNCE_MS),
      )
      .subscribe((offline) => this.settle(offline));

    this.probeDue$ = combineLatest([this.browserOnline$, this.serverUnreachable$]).pipe(
      map(([online, unreachable]) => online && unreachable),
      distinctUntilChanged(),
      switchMap((due) =>
        due ? interval(PAM_RECONNECT_PROBE_INTERVAL_MS).pipe(map((): void => undefined)) : EMPTY,
      ),
    );
  }

  /**
   * Runs `probe` on each {@link probeDue$} tick, one at a time. `probe` must be a read through the
   * guarded SDK services, whose outcome is what clears or keeps the unreachable mark; its result
   * and errors are otherwise ignored.
   */
  startProbing(probe: () => Promise<unknown>): Subscription {
    return this.probeDue$
      .pipe(exhaustMap(() => from(probe()).pipe(catchError(() => of(undefined)))))
      .subscribe();
  }

  /** The undebounced state: no network, or the server last failed to answer. */
  get offlineNow(): boolean {
    return this.rawOffline();
  }

  get browserOffline(): boolean {
    return !this.browserOnline$.value;
  }

  reportReachable(): void {
    if (this.serverUnreachable$.value) {
      this.serverUnreachable$.next(false);
    }
  }

  reportUnreachable(): void {
    if (!this.serverUnreachable$.value) {
      this.serverUnreachable$.next(true);
    }
  }

  private rawOffline(): boolean {
    return !this.browserOnline$.value || this.serverUnreachable$.value;
  }

  private settle(offline: boolean): void {
    const wasOffline = this.settled$.value;
    if (wasOffline === offline) {
      return;
    }
    this.settled$.next(offline);
    if (wasOffline && !offline) {
      this.reconnectedSubject$.next();
    }
  }
}
