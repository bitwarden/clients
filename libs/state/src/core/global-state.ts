import { Observable } from "rxjs";

import { StateUpdateOptions } from "./state-update-options";

/**
 * A helper object for interacting with state that is scoped to a specific domain
 * but is not scoped to a user. This is application wide storage.
 */
export interface GlobalState<T> {
  /**
   * Method for allowing you to manipulate state in an additive way.
   * @param configureState callback for how you want to manipulate this section of state
   * @param options Defaults given by @see {module:state-update-options#DEFAULT_OPTIONS}
   * @param options.shouldUpdate A callback for determining if you want to update state. Defaults to () => true
   * @param options.combineLatestWith An observable that you want to combine with the current state for callbacks. Defaults to null
   * @param options.msTimeout A timeout for how long you are willing to wait for a `combineLatestWith` option to complete. Defaults to 1000ms. Only applies if `combineLatestWith` is set.
   * @returns A promise that must be awaited before your next action to ensure the update has been written to state.
   * Resolves to the new state. If `shouldUpdate` returns false, the promise will resolve to the current state.
   */
  update: <TCombine>(
    configureState: (state: T | null, dependency: TCombine) => T | null,
    options?: StateUpdateOptions<T, TCombine>,
  ) => Promise<T | null>;

  /**
   * An observable stream of this state, the first emission of this will be the current state on disk
   * and subsequent updates will be from an update to that state.
   */
  state$: Observable<T | null>;
}
