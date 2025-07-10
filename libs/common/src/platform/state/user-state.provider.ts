import { Observable } from "rxjs";

import { UserId } from "../../types/guid";

import { UserKeyDefinition } from "./user-key-definition";
import { ActiveUserState, SingleUserState } from "./user-state";

/** A provider for getting an implementation of state scoped to a given key and userId */
export abstract class SingleUserStateProvider {
  /**
   * Gets a {@link SingleUserState} scoped to the given {@link UserKeyDefinition} and {@link UserId}
   *
   * @param userId - The {@link UserId} for which you want the user state for.
   * @param userKeyDefinition - The {@link UserKeyDefinition} for which you want the user state for.
   */
  abstract get<T>(userId: UserId, userKeyDefinition: UserKeyDefinition<T>): SingleUserState<T>;
}

/** A provider for getting an implementation of state scoped to a given key, but always pointing
 * to the currently active user
 */
export abstract class ActiveUserStateProvider {
  /**
   * Convenience re-emission of active user ID from {@link AccountService.activeAccount$}
   */
  abstract activeUserId$: Observable<UserId | undefined>;

  /**
   * Gets a {@link ActiveUserState} scoped to the given {@link KeyDefinition}, but updates when active user changes such
   * that the emitted values always represents the state for the currently active user.
   *
   * @param keyDefinition - The {@link UserKeyDefinition} for which you want the user state for.
   */
  abstract get<T>(userKeyDefinition: UserKeyDefinition<T>): ActiveUserState<T>;
}
