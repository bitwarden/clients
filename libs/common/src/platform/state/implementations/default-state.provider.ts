import { Observable, filter, of, switchMap, take } from "rxjs";

import { UserId } from "../../../types/guid";
import { DerivedStateDependencies } from "../../../types/state";
import { DeriveDefinition } from "../derive-definition";
import { DerivedState } from "../derived-state";
import { DerivedStateProvider } from "../derived-state.provider";
import { GlobalStateProvider } from "../global-state.provider";
import { KeyDefinition } from "../key-definition";
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

  getUserState$<T>(
    keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>,
    userId?: UserId,
  ): Observable<T> {
    if (userId) {
      return this.getUser<T>(userId, keyDefinition).state$;
    } else {
      return this.activeUserId$.pipe(
        filter((userId) => userId != null), // Filter out null-ish user ids since we can't get state for a null user id
        take(1),
        switchMap((userId) => this.getUser<T>(userId, keyDefinition).state$),
      );
    }
  }

  getUserStateOrDefault$<T>(
    keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>,
    config: { userId: UserId | undefined; defaultValue?: T },
  ): Observable<T> {
    const { userId, defaultValue = null } = config;
    if (userId) {
      return this.getUser<T>(userId, keyDefinition).state$;
    } else {
      return this.activeUserId$.pipe(
        take(1),
        switchMap((userId) =>
          userId != null ? this.getUser<T>(userId, keyDefinition).state$ : of(defaultValue),
        ),
      );
    }
  }

  async setUserState<T>(
    keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>,
    value: T,
    userId?: UserId,
  ): Promise<[UserId, T]> {
    if (userId) {
      return [userId, await this.getUser<T>(userId, keyDefinition).update(() => value)];
    } else {
      return await this.getActive<T>(keyDefinition).update(() => value);
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
