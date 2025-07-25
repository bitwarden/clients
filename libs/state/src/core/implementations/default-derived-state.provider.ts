import { Observable } from "rxjs";

import { DerivedStateDependencies } from "../../types/state";
import { DeriveDefinition } from "../derive-definition";
import { DerivedState } from "../derived-state";
import { DerivedStateProvider } from "../derived-state.provider";

import { DefaultDerivedState } from "./default-derived-state";

export class DefaultDerivedStateProvider implements DerivedStateProvider {
  /**
   * The cache uses a WeakMap to maintain separate derived states per user.
   * Each user's state Observable acts as a unique key, without needing to
   * pass around `userId`. Also, when a user's state Observable is cleaned up
   * (like during an account swap) their cache is automatically garbage
   * collected.
   */
  private cache = new WeakMap<Observable<unknown>, Record<string, DerivedState<unknown>>>();

  constructor() {}

  get<TFrom, TTo, TDeps extends DerivedStateDependencies>(
    parentState$: Observable<TFrom>,
    deriveDefinition: DeriveDefinition<TFrom, TTo, TDeps>,
    dependencies: TDeps,
  ): DerivedState<TTo> {
    let stateCache = this.cache.get(parentState$);
    if (!stateCache) {
      stateCache = {};
      this.cache.set(parentState$, stateCache);
    }

    const cacheKey = deriveDefinition.buildCacheKey();
    const existingDerivedState = stateCache[cacheKey];
    if (existingDerivedState != null) {
      // I have to cast out of the unknown generic but this should be safe if rules
      // around domain token are made
      return existingDerivedState as DefaultDerivedState<TFrom, TTo, TDeps>;
    }

    const newDerivedState = this.buildDerivedState(parentState$, deriveDefinition, dependencies);
    stateCache[cacheKey] = newDerivedState;
    return newDerivedState;
  }

  protected buildDerivedState<TFrom, TTo, TDeps extends DerivedStateDependencies>(
    parentState$: Observable<TFrom>,
    deriveDefinition: DeriveDefinition<TFrom, TTo, TDeps>,
    dependencies: TDeps,
  ): DerivedState<TTo> {
    return new DefaultDerivedState<TFrom, TTo, TDeps>(parentState$, deriveDefinition, dependencies);
  }
}
