import { Observable } from "rxjs";

import { UserId } from "../../types/guid";
import { DerivedStateDependencies } from "../../types/state";

import { DeriveDefinition } from "./derive-definition";
import { DerivedState } from "./derived-state";
import { GlobalState } from "./global-state";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used in docs
import { GlobalStateProvider } from "./global-state.provider";
import { KeyDefinition } from "./key-definition";
import { UserKeyDefinition } from "./user-key-definition";
import { ActiveUserState, SingleUserState } from "./user-state";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used in docs
import { ActiveUserStateProvider, SingleUserStateProvider } from "./user-state.provider";

/** Convenience wrapper class for {@link ActiveUserStateProvider}, {@link SingleUserStateProvider},
 * and {@link GlobalStateProvider}.
 */
export abstract class StateProvider {
  /** @see{@link ActiveUserStateProvider.activeUserId$} */
  abstract activeUserId$: Observable<UserId | undefined>;

  /**
   * Gets a state observable for a given key and userId.
   *
   * @remarks If userId is falsy the observable returned will attempt to point to the currently active user _and not update if the active user changes_.
   * This is different to how `getActive` works and more similar to `getUser` for whatever user happens to be active at the time of the call.
   * If no user happens to be active at the time this method is called with a falsy userId then this observable will not emit a value until
   * a user becomes active. If you are not confident a user is active at the time this method is called, you may want to pipe a call to `timeout`
   * or instead call {@link getUserStateOrDefault$} and supply a value you would rather have given in the case of no passed in userId and no active user.
   *
   * @param keyDefinition - The key definition for the state you want to get.
   * @param userId - The userId for which you want the state for. If not provided, the state for the currently active user will be returned.
   */
  abstract getUserState$<T>(keyDefinition: UserKeyDefinition<T>, userId?: UserId): Observable<T>;

  /**
   * Gets a state observable for a given key and userId
   *
   * @remarks If userId is falsy the observable return will first attempt to point to the currently active user but will not follow subsequent active user changes,
   * if there is no immediately available active user, then it will fallback to returning a default value in an observable that immediately completes.
   *
   * @param keyDefinition - The key definition for the state you want to get.
   * @param config.userId - The userId for which you want the state for. If not provided, the state for the currently active user will be returned.
   * @param config.defaultValue - The default value that should be wrapped in an observable if no active user is immediately available and no truthy userId is passed in.
   */
  abstract getUserStateOrDefault$<T>(
    keyDefinition: UserKeyDefinition<T>,
    config: { userId: UserId | undefined; defaultValue?: T },
  ): Observable<T>;

  /**
   * Sets the state for a given key and userId.
   *
   * @overload
   * @param keyDefinition - The key definition for the state you want to set.
   * @param value - The value to set the state to.
   * @param userId - The userId for which you want to set the state for. If not provided, the state for the currently active user will be set.
   */
  abstract setUserState<T>(
    keyDefinition: UserKeyDefinition<T>,
    value: T,
    userId?: UserId,
  ): Promise<[UserId, T]>;

  /** @see{@link ActiveUserStateProvider.get} */
  abstract getActive<T>(userKeyDefinition: UserKeyDefinition<T>): ActiveUserState<T>;

  /** @see{@link SingleUserStateProvider.get} */
  abstract getUser<T>(userId: UserId, userKeyDefinition: UserKeyDefinition<T>): SingleUserState<T>;

  /** @see{@link GlobalStateProvider.get} */
  abstract getGlobal<T>(keyDefinition: KeyDefinition<T>): GlobalState<T>;
  abstract getDerived<TFrom, TTo, TDeps extends DerivedStateDependencies>(
    parentState$: Observable<TFrom>,
    deriveDefinition: DeriveDefinition<TFrom, TTo, TDeps>,
    dependencies: TDeps,
  ): DerivedState<TTo>;
}
