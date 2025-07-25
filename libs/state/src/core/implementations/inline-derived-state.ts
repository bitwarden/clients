import { Observable, concatMap } from "rxjs";

import { DerivedStateDependencies } from "../../types/state";
import { DeriveDefinition } from "../derive-definition";
import { DerivedState } from "../derived-state";
import { DerivedStateProvider } from "../derived-state.provider";

export class InlineDerivedStateProvider implements DerivedStateProvider {
  get<TFrom, TTo, TDeps extends DerivedStateDependencies>(
    parentState$: Observable<TFrom>,
    deriveDefinition: DeriveDefinition<TFrom, TTo, TDeps>,
    dependencies: TDeps,
  ): DerivedState<TTo> {
    return new InlineDerivedState(parentState$, deriveDefinition, dependencies);
  }
}

export class InlineDerivedState<TFrom, TTo, TDeps extends DerivedStateDependencies>
  implements DerivedState<TTo>
{
  constructor(
    parentState$: Observable<TFrom>,
    deriveDefinition: DeriveDefinition<TFrom, TTo, TDeps>,
    dependencies: TDeps,
  ) {
    this.state$ = parentState$.pipe(
      concatMap(async (value) => await deriveDefinition.derive(value, dependencies)),
    );
  }

  state$: Observable<TTo>;

  forceValue(value: TTo): Promise<TTo> {
    // No need to force anything, we don't keep a cache
    return Promise.resolve(value);
  }
}
