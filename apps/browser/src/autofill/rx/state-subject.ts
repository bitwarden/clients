import {
  concatMap,
  map,
  Observable,
  ReplaySubject,
  shareReplay,
  Subject,
  SubjectLike,
  Subscription,
  switchMap,
  takeUntil,
} from "rxjs";

import { anyComplete, pin, withLatestReady } from "@bitwarden/common/tools/rx";
import { SingleUserState } from "@bitwarden/state";

/**
 * A subject over a user's stored state.
 *
 * Values sent to `next` are written to storage; the last value sent before the user is known is
 * the one written. What subscribers read is the stored state, replayed from memory: the stored
 * value reaches a `ReplaySubject` whenever the state emits, so a subscriber receives the current
 * value synchronously on subscribe.
 *
 * The subject completes when `state$` completes, or when `complete` is called.
 *
 * The subject is bound to a single backend: `state$` is pinned, so a second, different state is an
 * error.
 *
 * @param state$ The backing state. Completing it completes the subject.
 * @param fallback Read when nothing is stored.
 */
export class StateSubject<T> extends Observable<T> implements SubjectLike<T> {
  private readonly writes$ = new Subject<T>();
  private readonly replay$: ReplaySubject<T>;
  private readonly subscription = new Subscription();

  constructor(state$: Observable<SingleUserState<T>>, fallback: T) {
    const replay$ = new ReplaySubject<T>(1);
    super((subscriber) => replay$.subscribe(subscriber));
    this.replay$ = replay$;

    const backend$ = state$.pipe(
      pin({ name: () => "StateSubject { state$ }", distinct: (a, b) => a === b }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    const ended$ = anyComplete(backend$);

    this.subscription.add(
      backend$
        .pipe(
          switchMap((state) => state.state$),
          map((value) => value ?? fallback),
          takeUntil(ended$),
        )
        .subscribe({
          next: (value) => replay$.next(value),
          error: (error: unknown) => this.error(error),
          complete: () => this.complete(),
        }),
    );

    // writes queue behind the user and are serialized, so an older value cannot land after a newer
    this.subscription.add(
      this.writes$
        .pipe(
          withLatestReady(backend$),
          concatMap(([value, state]) => state.update(() => value)),
          takeUntil(ended$),
        )
        .subscribe({ error: (error: unknown) => this.error(error) }),
    );
  }

  next(value: T): void {
    this.writes$.next(value);
  }

  error(error: unknown): void {
    this.subscription.unsubscribe();
    this.replay$.error(error);
  }

  complete(): void {
    this.subscription.unsubscribe();
    this.replay$.complete();
  }
}
