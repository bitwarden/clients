// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mock } from "jest-mock-extended";
import { Observable, map, of, switchMap, take } from "rxjs";

import {
  GlobalState,
  GlobalStateProvider,
  KeyDefinition,
  ActiveUserState,
  SingleUserState,
  SingleUserStateProvider,
  StateProvider,
  ActiveUserStateProvider,
  DerivedState,
  DeriveDefinition,
  DerivedStateProvider,
  UserKeyDefinition,
} from "../src/platform/state";
import { UserId } from "../src/types/guid";
import { DerivedStateDependencies } from "../src/types/state";

import { FakeAccountService } from "./fake-account-service";
import {
  FakeActiveUserState,
  FakeDerivedState,
  FakeGlobalState,
  FakeSingleUserState,
} from "./fake-state";

export class FakeGlobalStateProvider implements GlobalStateProvider {
  mock = mock<GlobalStateProvider>();
  establishedMocks: Map<string, FakeGlobalState<unknown>> = new Map();
  states: Map<string, GlobalState<unknown>> = new Map();
  get<T>(keyDefinition: KeyDefinition<T>): GlobalState<T> {
    this.mock.get(keyDefinition);
    const cacheKey = this.cacheKey(keyDefinition);
    let result = this.states.get(cacheKey);

    if (result == null) {
      let fake: FakeGlobalState<T>;
      // Look for established mock
      if (this.establishedMocks.has(keyDefinition.key)) {
        fake = this.establishedMocks.get(keyDefinition.key) as FakeGlobalState<T>;
      } else {
        fake = new FakeGlobalState<T>();
      }
      fake.keyDefinition = keyDefinition;
      result = fake;
      this.states.set(cacheKey, result);

      result = new FakeGlobalState<T>();
      this.states.set(cacheKey, result);
    }
    return result as GlobalState<T>;
  }

  private cacheKey(keyDefinition: KeyDefinition<unknown>) {
    return `${keyDefinition.fullName}_${keyDefinition.stateDefinition.defaultStorageLocation}`;
  }

  getFake<T>(keyDefinition: KeyDefinition<T>): FakeGlobalState<T> {
    return this.get(keyDefinition) as FakeGlobalState<T>;
  }

  mockFor<T>(keyDefinition: KeyDefinition<T>, initialValue?: T): FakeGlobalState<T> {
    const cacheKey = this.cacheKey(keyDefinition);
    if (!this.states.has(cacheKey)) {
      this.states.set(cacheKey, new FakeGlobalState<T>(initialValue));
    }
    return this.states.get(cacheKey) as FakeGlobalState<T>;
  }
}

export class FakeSingleUserStateProvider implements SingleUserStateProvider {
  mock = mock<SingleUserStateProvider>();
  states: Map<string, SingleUserState<unknown>> = new Map();

  constructor(
    readonly updateSyncCallback?: (
      key: UserKeyDefinition<unknown>,
      userId: UserId,
      newValue: unknown,
    ) => Promise<void>,
  ) {}

  get<T>(userId: UserId, userKeyDefinition: UserKeyDefinition<T>): SingleUserState<T> {
    this.mock.get(userId, userKeyDefinition);
    const cacheKey = this.cacheKey(userId, userKeyDefinition);
    let result = this.states.get(cacheKey);

    if (result == null) {
      result = this.buildFakeState(userId, userKeyDefinition);
      this.states.set(cacheKey, result);
    }
    return result as SingleUserState<T>;
  }

  getFake<T>(
    userId: UserId,
    userKeyDefinition: UserKeyDefinition<T>,
    { allowInit }: { allowInit: boolean } = { allowInit: true },
  ): FakeSingleUserState<T> {
    if (!allowInit && this.states.get(this.cacheKey(userId, userKeyDefinition)) == null) {
      return null;
    }

    return this.get(userId, userKeyDefinition) as FakeSingleUserState<T>;
  }

  mockFor<T>(
    userId: UserId,
    userKeyDefinition: UserKeyDefinition<T>,
    initialValue?: T,
  ): FakeSingleUserState<T> {
    const cacheKey = this.cacheKey(userId, userKeyDefinition);
    if (!this.states.has(cacheKey)) {
      this.states.set(cacheKey, this.buildFakeState(userId, userKeyDefinition, initialValue));
    }
    return this.states.get(cacheKey) as FakeSingleUserState<T>;
  }

  private buildFakeState<T>(
    userId: UserId,
    userKeyDefinition: UserKeyDefinition<T>,
    initialValue?: T,
  ) {
    const state = new FakeSingleUserState(userId, initialValue, async (...args) => {
      await this.updateSyncCallback?.(userKeyDefinition, ...args);
    });
    state.keyDefinition = userKeyDefinition;
    return state;
  }

  private cacheKey(userId: UserId, userKeyDefinition: UserKeyDefinition<unknown>) {
    return `${userKeyDefinitionCacheKey(userKeyDefinition)}_${userId}`;
  }
}

export class FakeActiveUserStateProvider implements ActiveUserStateProvider {
  activeUserId$: Observable<UserId>;
  states: Map<string, FakeActiveUserState<unknown>> = new Map();

  constructor(
    public accountService: FakeAccountService,
    readonly updateSyncCallback?: (
      key: UserKeyDefinition<unknown>,
      userId: UserId,
      newValue: unknown,
    ) => Promise<void>,
  ) {
    this.activeUserId$ = accountService.activeAccountSubject.asObservable().pipe(map((a) => a?.id));
  }

  get<T>(userKeyDefinition: UserKeyDefinition<T>): ActiveUserState<T> {
    const cacheKey = userKeyDefinitionCacheKey(userKeyDefinition);
    let result = this.states.get(cacheKey);

    if (result == null) {
      result = this.buildFakeState(userKeyDefinition);
      this.states.set(cacheKey, result);
    }
    return result as ActiveUserState<T>;
  }

  getFake<T>(
    userKeyDefinition: UserKeyDefinition<T>,
    { allowInit }: { allowInit: boolean } = { allowInit: true },
  ): FakeActiveUserState<T> {
    if (!allowInit && this.states.get(userKeyDefinitionCacheKey(userKeyDefinition)) == null) {
      return null;
    }
    return this.get(userKeyDefinition) as FakeActiveUserState<T>;
  }

  mockFor<T>(userKeyDefinition: UserKeyDefinition<T>, initialValue?: T): FakeActiveUserState<T> {
    const cacheKey = userKeyDefinitionCacheKey(userKeyDefinition);
    if (!this.states.has(cacheKey)) {
      this.states.set(cacheKey, this.buildFakeState(userKeyDefinition, initialValue));
    }
    return this.states.get(cacheKey) as FakeActiveUserState<T>;
  }

  private buildFakeState<T>(userKeyDefinition: UserKeyDefinition<T>, initialValue?: T) {
    const state = new FakeActiveUserState<T>(this.accountService, initialValue, async (...args) => {
      await this.updateSyncCallback?.(userKeyDefinition, ...args);
    });
    state.keyDefinition = userKeyDefinition;
    return state;
  }
}

function userKeyDefinitionCacheKey(userKeyDefinition: UserKeyDefinition<unknown>) {
  return `${userKeyDefinition.fullName}_${userKeyDefinition.stateDefinition.defaultStorageLocation}`;
}

export class FakeStateProvider implements StateProvider {
  mock = mock<StateProvider>();
  getUserState$<T>(userKeyDefinition: UserKeyDefinition<T>, userId?: UserId): Observable<T> {
    this.mock.getUserState$(userKeyDefinition, userId);
    if (userId) {
      return this.getUser<T>(userId, userKeyDefinition).state$;
    }

    return this.getActive(userKeyDefinition).state$;
  }

  getUserStateOrDefault$<T>(
    userKeyDefinition: UserKeyDefinition<T>,
    config: { userId: UserId | undefined; defaultValue?: T },
  ): Observable<T> {
    const { userId, defaultValue = null } = config;
    this.mock.getUserStateOrDefault$(userKeyDefinition, config);
    if (userId) {
      return this.getUser<T>(userId, userKeyDefinition).state$;
    }

    return this.activeUserId$.pipe(
      take(1),
      switchMap((userId) =>
        userId != null ? this.getUser(userId, userKeyDefinition).state$ : of(defaultValue),
      ),
    );
  }

  async setUserState<T>(
    userKeyDefinition: UserKeyDefinition<T>,
    value: T | null,
    userId?: UserId,
  ): Promise<[UserId, T | null]> {
    await this.mock.setUserState(userKeyDefinition, value, userId);
    if (userId) {
      return [userId, await this.getUser(userId, userKeyDefinition).update(() => value)];
    } else {
      return await this.getActive(userKeyDefinition).update(() => value);
    }
  }

  getActive<T>(userKeyDefinition: UserKeyDefinition<T>): ActiveUserState<T> {
    return this.activeUser.get(userKeyDefinition);
  }

  getGlobal<T>(keyDefinition: KeyDefinition<T>): GlobalState<T> {
    return this.global.get(keyDefinition);
  }

  getUser<T>(userId: UserId, userKeyDefinition: UserKeyDefinition<T>): SingleUserState<T> {
    return this.singleUser.get(userId, userKeyDefinition);
  }

  getDerived<TFrom, TTo, TDeps extends DerivedStateDependencies>(
    parentState$: Observable<TFrom>,
    deriveDefinition: DeriveDefinition<unknown, TTo, TDeps>,
    dependencies: TDeps,
  ): DerivedState<TTo> {
    return this.derived.get(parentState$, deriveDefinition, dependencies);
  }

  constructor(public accountService: FakeAccountService) {}

  private distributeSingleUserUpdate(
    key: UserKeyDefinition<unknown>,
    userId: UserId,
    newState: unknown,
  ) {
    if (this.activeUser.accountService.activeUserId === userId) {
      const state = this.activeUser.getFake(key, { allowInit: false });
      state?.nextState(newState, { syncValue: false });
    }
  }

  private distributeActiveUserUpdate(
    key: UserKeyDefinition<unknown>,
    userId: UserId,
    newState: unknown,
  ) {
    this.singleUser
      .getFake(userId, key, { allowInit: false })
      ?.nextState(newState, { syncValue: false });
  }

  global: FakeGlobalStateProvider = new FakeGlobalStateProvider();
  singleUser: FakeSingleUserStateProvider = new FakeSingleUserStateProvider(
    this.distributeSingleUserUpdate.bind(this),
  );
  activeUser: FakeActiveUserStateProvider = new FakeActiveUserStateProvider(
    this.accountService,
    this.distributeActiveUserUpdate.bind(this),
  );
  derived: FakeDerivedStateProvider = new FakeDerivedStateProvider();
  activeUserId$: Observable<UserId> = this.activeUser.activeUserId$;
}

export class FakeDerivedStateProvider implements DerivedStateProvider {
  states: Map<string, DerivedState<unknown>> = new Map();
  get<TFrom, TTo, TDeps extends DerivedStateDependencies>(
    parentState$: Observable<TFrom>,
    deriveDefinition: DeriveDefinition<TFrom, TTo, TDeps>,
    dependencies: TDeps,
  ): DerivedState<TTo> {
    let result = this.states.get(deriveDefinition.buildCacheKey()) as DerivedState<TTo>;

    if (result == null) {
      result = new FakeDerivedState(parentState$, deriveDefinition, dependencies);
      this.states.set(deriveDefinition.buildCacheKey(), result);
    }
    return result;
  }
}
