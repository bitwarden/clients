import {
  Observer,
  SubjectLike,
  Unsubscribable,
  ReplaySubject,
  filter,
  map,
  Subject,
  takeUntil,
  pairwise,
  combineLatest,
  distinctUntilChanged,
  BehaviorSubject,
  race,
  ignoreElements,
  endWith,
  startWith,
} from "rxjs";
import { Simplify } from "type-fest";

import { SingleUserState } from "@bitwarden/common/platform/state";

import { Dependencies, SingleUserDependency, WhenDependency } from "../dependencies";

/** dependencies accepted by the user state subject */
export type UserStateSubjectDependencies<State, Dependency> = Simplify<
  SingleUserDependency &
    Partial<WhenDependency> &
    Partial<Dependencies<Dependency>> & {
      /** Compute the next stored value. If this is not set, values
       *  provided to `next` unconditionally override state.
       *  @param current the value stored in state
       *  @param next the value received by the user state subject's `next` member
       *  @param dependencies the latest value from `Dependencies<TCombine>`
       *  @returns the value to store in state
       */
      nextValue?: (current: State, next: State, dependencies?: Dependency) => State;
      /**
       * Compute whether the state should update. If this is not set, values
       * provided to `next` always update the state.
       * @param current the value stored in state
       * @param next the value received by the user state subject's `next` member
       * @param dependencies the latest value from `Dependencies<TCombine>`
       * @returns `true` if the value should be stored, otherwise `false`.
       */
      shouldUpdate?: (value: State, next: State, dependencies?: Dependency) => boolean;
    }
>;

/**
 * Adapt a state provider to an rxjs subject.
 *
 * This subject buffers the last value it received in memory. The buffer is erased
 * if the subject receives a complete or error event. It does not persist the buffer.
 *
 * Warning! The user state subject has a synchronous interface, but subscriptions are
 * always asynchronous.
 *
 * @template State the state stored by the subject
 * @template Dependencies use-specific dependencies provided by the user.
 */
export class UserStateSubject<State, Dependencies = null> implements SubjectLike<State> {
  /**
   * Instantiates the user state subject
   * @param state the backing store of the subject
   * @param dependencies tailor the subject's behavior for a particular
   *   purpose.
   * @param dependencies.when$ blocks updates to the state subject until
   *   this becomes true. When this occurs, only the last-received update
   *   is applied. The blocked update is kept in memory. It does not persist
   *   to disk.
   * @param dependencies.singleUserId$ writes block until the singleUserId$
   *   is available.
   */
  constructor(
    private state: SingleUserState<State>,
    private dependencies: UserStateSubjectDependencies<State, Dependencies>,
  ) {
    // normalize dependencies
    const when$ = (this.dependencies.when$ ?? new BehaviorSubject(true)).pipe(
      distinctUntilChanged(),
    );
    const userIdAvailable$ = this.dependencies.singleUserId$.pipe(
      startWith(state.userId),
      pairwise(),
      map(([expectedUserId, actualUserId]) => {
        if (expectedUserId === actualUserId) {
          return true;
        } else {
          throw { expectedUserId, actualUserId };
        }
      }),
      distinctUntilChanged(),
    );

    // observe completion
    const whenComplete$ = when$.pipe(ignoreElements(), endWith(true));
    const inputComplete$ = this.input.pipe(ignoreElements(), endWith(true));
    const userIdComplete$ = this.dependencies.singleUserId$.pipe(ignoreElements(), endWith(true));
    const completion$ = race(whenComplete$, inputComplete$, userIdComplete$);

    // wire subscriptions
    this.outputSubscription = this.state.state$.subscribe(this.output);
    this.inputSubscription = combineLatest([this.input, when$, userIdAvailable$])
      .pipe(
        filter(([_, when]) => when),
        map(([state]) => state),
        takeUntil(completion$),
      )
      .subscribe({
        next: (r) => this.onNext(r),
        error: (e: unknown) => this.onError(e),
        complete: () => this.onComplete(),
      });
  }

  next(value: State) {
    this.input?.next(value);
  }

  error(err: any) {
    this.input?.error(err);
  }

  complete() {
    this.input?.complete();
  }

  /** Subscribe to the subject's event stream
   * @param observer listening for events
   * @returns the subscription
   */
  subscribe(observer: Partial<Observer<State>> | ((value: State) => void)): Unsubscribable {
    return this.output.subscribe(observer);
  }

  // using subjects to ensure the right semantics are followed;
  // if greater efficiency becomes desirable, consider implementing
  // `SubjectLike` directly
  private input = new Subject<State>();
  private readonly output = new ReplaySubject<State>(1);

  private inputSubscription: Unsubscribable;
  private outputSubscription: Unsubscribable;

  private onNext(value: State) {
    const nextValue = this.dependencies.nextValue ?? ((_: State, next: State) => next);
    const shouldUpdate = this.dependencies.shouldUpdate ?? ((_: State) => true);

    this.state
      .update(
        (state, dependencies) => {
          const next = nextValue(state, value, dependencies);
          return next;
        },
        {
          shouldUpdate(current, dependencies) {
            const update = shouldUpdate(current, value, dependencies);
            return update;
          },
          combineLatestWith: this.dependencies.dependencies$,
        },
      )
      .catch((e: any) => this.onError(e));
  }

  private onError(value: any) {
    if (!this.isDisposed) {
      this.output.error(value);
    }

    this.dispose();
  }

  private onComplete() {
    if (!this.isDisposed) {
      this.output.complete();
    }

    this.dispose();
  }

  private get isDisposed() {
    return this.input === null;
  }

  private dispose() {
    if (!this.isDisposed) {
      // clean up internal subscriptions
      this.inputSubscription.unsubscribe();
      this.outputSubscription.unsubscribe();
      this.inputSubscription = null;
      this.outputSubscription = null;

      // drop input to ensure its value is removed from memory
      this.input = null;
    }
  }
}
