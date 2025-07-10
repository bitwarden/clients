import { Observable } from "rxjs";

import { DerivedStateDependencies } from "../../types/state";

import { DeriveDefinition } from "./derive-definition";
import { DerivedState } from "./derived-state";

/**
 * State derived from an observable and a derive function
 */
export abstract class DerivedStateProvider {
  /**
   * Creates a derived state observable from a parent state observable, a deriveDefinition, and the dependencies
   * required by the deriveDefinition
   * @param parentState$ The parent state observable
   * @param deriveDefinition The deriveDefinition that defines conversion from the parent state to the derived state as
   * well as some memory persistent information.
   * @param dependencies The dependencies of the derive function
   */
  abstract get<TFrom, TTo, TDeps extends DerivedStateDependencies>(
    parentState$: Observable<TFrom>,
    deriveDefinition: DeriveDefinition<TFrom, TTo, TDeps>,
    dependencies: TDeps,
  ): DerivedState<TTo>;
}
