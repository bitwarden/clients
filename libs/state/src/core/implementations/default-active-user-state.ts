// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, map, switchMap, firstValueFrom, timeout, throwError, NEVER } from "rxjs";

import { UserId } from "@bitwarden/user-core";

import { StateUpdateOptions } from "../state-update-options";
import { UserKeyDefinition } from "../user-key-definition";
import { ActiveUserState, CombinedState, activeMarker } from "../user-state";
import { SingleUserStateProvider } from "../user-state.provider";

export class DefaultActiveUserState<T> implements ActiveUserState<T> {
  [activeMarker]: true;
  combinedState$: Observable<CombinedState<T>>;
  state$: Observable<T>;

  constructor(
    protected keyDefinition: UserKeyDefinition<T>,
    private activeUserId$: Observable<UserId | null>,
    private singleUserStateProvider: SingleUserStateProvider,
  ) {
    this.combinedState$ = this.activeUserId$.pipe(
      switchMap((userId) =>
        userId != null
          ? this.singleUserStateProvider.get(userId, this.keyDefinition).combinedState$
          : NEVER,
      ),
    );

    // State should just be combined state without the user id
    this.state$ = this.combinedState$.pipe(map(([_userId, state]) => state));
  }

  async update<TCombine>(
    configureState: (state: T, dependency: TCombine) => T,
    options: StateUpdateOptions<T, TCombine> = {},
  ): Promise<[UserId, T]> {
    const userId = await firstValueFrom(
      this.activeUserId$.pipe(
        timeout({
          first: 1000,
          with: () =>
            throwError(
              () =>
                new Error(
                  `Timeout while retrieving active user for key ${this.keyDefinition.fullName}.`,
                ),
            ),
        }),
      ),
    );
    if (userId == null) {
      throw new Error(
        `Error storing ${this.keyDefinition.fullName} for the active user: No active user at this time.`,
      );
    }

    return [
      userId,
      await this.singleUserStateProvider
        .get(userId, this.keyDefinition)
        .update(configureState, options),
    ];
  }
}
