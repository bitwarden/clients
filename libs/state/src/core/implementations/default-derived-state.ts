import { Observable, ReplaySubject, Subject, concatMap, merge, share, timer } from "rxjs";

import { DerivedStateDependencies } from "../../../types/state";
import { DeriveDefinition } from "../derive-definition";
import { DerivedState } from "../derived-state";

/**
 * Default derived state
 */
export class DefaultDerivedState<TFrom, TTo, TDeps extends DerivedStateDependencies>
  implements DerivedState<TTo>
{
  private readonly storageKey: string;
  private forcedValueSubject = new Subject<TTo>();

  state$: Observable<TTo>;

  constructor(
    private parentState$: Observable<TFrom>,
    protected deriveDefinition: DeriveDefinition<TFrom, TTo, TDeps>,
    private dependencies: TDeps,
  ) {
    this.storageKey = deriveDefinition.storageKey;

    const derivedState$ = this.parentState$.pipe(
      concatMap(async (state) => {
        let derivedStateOrPromise = this.deriveDefinition.derive(state, this.dependencies);
        if (derivedStateOrPromise instanceof Promise) {
          derivedStateOrPromise = await derivedStateOrPromise;
        }
        const derivedState = derivedStateOrPromise;
        return derivedState;
      }),
    );

    this.state$ = merge(this.forcedValueSubject, derivedState$).pipe(
      share({
        connector: () => {
          return new ReplaySubject<TTo>(1);
        },
        resetOnRefCountZero: () => timer(this.deriveDefinition.cleanupDelayMs),
      }),
    );
  }

  async forceValue(value: TTo) {
    this.forcedValueSubject.next(value);
    return value;
  }
}
