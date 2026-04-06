import { Observable } from "rxjs";

import { UserId } from "@bitwarden/user-core";

import { StateUpdateOptions } from "./state-update-options";

export type CombinedState<T> = readonly [userId: UserId, state: T];

/** A helper object for interacting with state that is scoped to a specific user. */
export interface UserState<T> {
  /** Emits a stream of data. Emits null if the user does not have specified state. */
  readonly state$: Observable<T | null>;

  /** Emits a stream of tuples, with the first element being a user id and the second element being the data for that user. */
  readonly combinedState$: Observable<CombinedState<T | null>>;
}

export const activeMarker: unique symbol = Symbol("active");

export interface ActiveUserState<T> extends UserState<T> {
  readonly [activeMarker]: true;

  /**
   * Emits a stream of data. Emits null if the user does not have specified state.
   * Note: Will not emit if there is no active user.
   */
  readonly state$: Observable<T | null>;

  /**
   * Updates backing stores for the active user.
   * @param configureState function that takes the current state and returns the new state
   * @param options Defaults to @see {module:state-update-options#DEFAULT_OPTIONS}
   * @param options.shouldUpdate A callback for determining if you want to update state. Defaults to () => true
   * @param options.combineLatestWith An observable that you want to combine with the current state for callbacks. Defaults to null
   * @param options.msTimeout A timeout for how long you are willing to wait for a `combineLatestWith` option to complete. Defaults to 1000ms. Only applies if `combineLatestWith` is set.
   *
   * @returns A promise that must be awaited before your next action to ensure the update has been written to state.
   * Resolves to the new state. If `shouldUpdate` returns false, the promise will resolve to the current state.
   */
  readonly update: <TCombine>(
    configureState: (state: T | null, dependencies: TCombine) => T | null,
    options?: Partial<StateUpdateOptions<T, TCombine>>,
  ) => Promise<[UserId, T | null]>;
}

export interface SingleUserState<T> extends UserState<T> {
  readonly userId: UserId;

  /**
   * Updates backing stores for the active user.
   * @param configureState function that takes the current state and returns the new state
   * @param options Defaults to @see {module:state-update-options#DEFAULT_OPTIONS}
   * @param options.shouldUpdate A callback for determining if you want to update state. Defaults to () => true
   * @param options.combineLatestWith An observable that you want to combine with the current state for callbacks. Defaults to null
   * @param options.msTimeout A timeout for how long you are willing to wait for a `combineLatestWith` option to complete. Defaults to 1000ms. Only applies if `combineLatestWith` is set.
   *
   * @returns A promise that must be awaited before your next action to ensure the update has been written to state.
   * Resolves to the new state. If `shouldUpdate` returns false, the promise will resolve to the current state.
   */
  readonly update: <TCombine>(
    configureState: (state: T | null, dependencies: TCombine) => T | null,
    options?: Partial<StateUpdateOptions<T, TCombine>>,
  ) => Promise<T | null>;
}
