// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, filter, of, switchMap, take } from "rxjs";

import { UserId } from "@bitwarden/user-core";

import { DerivedStateDependencies } from "../../types/state";
import { DeriveDefinition } from "../derive-definition";
import { DerivedState } from "../derived-state";
import { DerivedStateProvider } from "../derived-state.provider";
import { GlobalStateProvider } from "../global-state.provider";
import { StateProvider } from "../state.provider";
import { UserKeyDefinition } from "../user-key-definition";
import { ActiveUserStateProvider, SingleUserStateProvider } from "../user-state.provider";

export class DefaultStateProvider implements StateProvider {
  activeUserId$: Observable<UserId>;
  constructor(
    private readonly activeUserStateProvider: ActiveUserStateProvider,
    private readonly singleUserStateProvider: SingleUserStateProvider,
    private readonly globalStateProvider: GlobalStateProvider,
    private readonly derivedStateProvider: DerivedStateProvider,
  ) {
    this.activeUserId$ = this.activeUserStateProvider.activeUserId$;
  }

  getUserState$<T>(userKeyDefinition: UserKeyDefinition<T>, userId?: UserId): Observable<T> {
    if (userId) {
      return this.getUser<T>(userId, userKeyDefinition).state$;
    } else {
      return this.activeUserId$.pipe(
        filter((userId) => userId != null), // Filter out null-ish user ids since we can't get state for a null user id
        take(1),
        switchMap((userId) => this.getUser<T>(userId, userKeyDefinition).state$),
      );
    }
  }

  getUserStateOrDefault$<T>(
    userKeyDefinition: UserKeyDefinition<T>,
    config: { userId: UserId | undefined; defaultValue?: T },
  ): Observable<T> {
    const { userId, defaultValue = null } = config;
    if (userId) {
      return this.getUser<T>(userId, userKeyDefinition).state$;
    } else {
      return this.activeUserId$.pipe(
        take(1),
        switchMap((userId) =>
          userId != null ? this.getUser<T>(userId, userKeyDefinition).state$ : of(defaultValue),
        ),
      );
    }
  }

  async setUserState<T>(
    userKeyDefinition: UserKeyDefinition<T>,
    value: T | null,
    userId?: UserId,
  ): Promise<[UserId, T | null]> {
    if (userId) {
      return [userId, await this.getUser<T>(userId, userKeyDefinition).update(() => value)];
    } else {
      return await this.getActive<T>(userKeyDefinition).update(() => value);
    }
  }

  getActive: InstanceType<typeof ActiveUserStateProvider>["get"] =
    this.activeUserStateProvider.get.bind(this.activeUserStateProvider);
  getUser: InstanceType<typeof SingleUserStateProvider>["get"] =
    this.singleUserStateProvider.get.bind(this.singleUserStateProvider);
  getGlobal: InstanceType<typeof GlobalStateProvider>["get"] = this.globalStateProvider.get.bind(
    this.globalStateProvider,
  );
  getDerived: <TFrom, TTo, TDeps extends DerivedStateDependencies>(
    parentState$: Observable<TFrom>,
    deriveDefinition: DeriveDefinition<unknown, TTo, TDeps>,
    dependencies: TDeps,
  ) => DerivedState<TTo> = this.derivedStateProvider.get.bind(this.derivedStateProvider);
}
