import { Observable } from "rxjs";

import { UserId } from "../../types/guid";

import { KeyDefinition } from "./key-definition";
import { UserKeyDefinition } from "./user-key-definition";
import { ActiveUserState, SingleUserState } from "./user-state";

/** A provider for getting an implementation of state scoped to a given key and userId */
export abstract class SingleUserStateProvider {
  /**
   * Gets a {@link SingleUserState} scoped to the given {@link KeyDefinition} and {@link UserId}
   *
   * **NOTE** Consider converting your {@link KeyDefinition} to a {@link UserKeyDefinition} for additional features.
   *
   * @param userId - The {@link UserId} for which you want the user state for.
   * @param keyDefinition - The {@link KeyDefinition} for which you want the user state for.
   */
  abstract get<T>(userId: UserId, keyDefinition: KeyDefinition<T>): SingleUserState<T>;

  /**
   * Gets a {@link SingleUserState} scoped to the given {@link UserKeyDefinition} and {@link UserId}
   *
   * @param userId - The {@link UserId} for which you want the user state for.
   * @param userKeyDefinition - The {@link UserKeyDefinition} for which you want the user state for.
   */
  abstract get<T>(userId: UserId, userKeyDefinition: UserKeyDefinition<T>): SingleUserState<T>;

  abstract get<T>(
    userId: UserId,
    keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>,
  ): SingleUserState<T>;
}

/** A provider for getting an implementation of state scoped to a given key, but always pointing
 * to the currently active user
 */
export abstract class ActiveUserStateProvider {
  /**
   * Convenience re-emission of active user ID from {@link AccountService.activeAccount$}
   */
  activeUserId$: Observable<UserId | undefined>;

  /**
   * Gets a {@link ActiveUserState} scoped to the given {@link KeyDefinition}, but updates when active user changes such
   * that the emitted values always represents the state for the currently active user.
   *
   * @param keyDefinition - The {@link UserKeyDefinition} for which you want the user state for.
   */
  abstract get<T>(userKeyDefinition: UserKeyDefinition<T>): ActiveUserState<T>;

  /**
   * Gets a {@link ActiveUserState} scoped to the given {@link KeyDefinition}, but updates when active user changes such
   * that the emitted values always represents the state for the currently active user.
   *
   * **NOTE** Consider converting your {@link KeyDefinition} to a {@link UserKeyDefinition} for additional features.
   *
   * @param keyDefinition - The {@link KeyDefinition} for which you want the user state for.
   */
  abstract get<T>(keyDefinition: KeyDefinition<T>): ActiveUserState<T>;

  abstract get<T>(keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>): ActiveUserState<T>;
}
