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
// eslint-disable-next-line import/no-restricted-paths -- Needed to type check similarly to the real state providers
import { isUserKeyDefinition } from "../src/platform/state/user-key-definition";
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
    const cacheKey = `${keyDefinition.fullName}_${keyDefinition.stateDefinition.defaultStorageLocation}`;
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

  getFake<T>(keyDefinition: KeyDefinition<T>): FakeGlobalState<T> {
    return this.get(keyDefinition) as FakeGlobalState<T>;
  }

  mockFor<T>(keyDefinitionKey: string, initialValue?: T): FakeGlobalState<T> {
    if (!this.establishedMocks.has(keyDefinitionKey)) {
      this.establishedMocks.set(keyDefinitionKey, new FakeGlobalState<T>(initialValue));
    }
    return this.establishedMocks.get(keyDefinitionKey) as FakeGlobalState<T>;
  }
}

export class FakeSingleUserStateProvider implements SingleUserStateProvider {
  mock = mock<SingleUserStateProvider>();
  establishedMocks: Map<string, FakeSingleUserState<unknown>> = new Map();
  states: Map<string, SingleUserState<unknown>> = new Map();
  get<T>(
    userId: UserId,
    keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>,
  ): SingleUserState<T> {
    this.mock.get(userId, keyDefinition);
    if (keyDefinition instanceof KeyDefinition) {
      keyDefinition = UserKeyDefinition.fromBaseKeyDefinition(keyDefinition);
    }
    const cacheKey = `${keyDefinition.fullName}_${keyDefinition.stateDefinition.defaultStorageLocation}_${userId}`;
    let result = this.states.get(cacheKey);

    if (result == null) {
      let fake: FakeSingleUserState<T>;
      // Look for established mock
      if (this.establishedMocks.has(keyDefinition.key)) {
        fake = this.establishedMocks.get(keyDefinition.key) as FakeSingleUserState<T>;
      } else {
        fake = new FakeSingleUserState<T>(userId);
      }
      fake.keyDefinition = keyDefinition;
      result = fake;
      this.states.set(cacheKey, result);
    }
    return result as SingleUserState<T>;
  }

  getFake<T>(
    userId: UserId,
    keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>,
  ): FakeSingleUserState<T> {
    return this.get(userId, keyDefinition) as FakeSingleUserState<T>;
  }

  mockFor<T>(userId: UserId, keyDefinitionKey: string, initialValue?: T): FakeSingleUserState<T> {
    if (!this.establishedMocks.has(keyDefinitionKey)) {
      this.establishedMocks.set(keyDefinitionKey, new FakeSingleUserState<T>(userId, initialValue));
    }
    return this.establishedMocks.get(keyDefinitionKey) as FakeSingleUserState<T>;
  }
}

export class FakeActiveUserStateProvider implements ActiveUserStateProvider {
  activeUserId$: Observable<UserId>;
  establishedMocks: Map<string, FakeActiveUserState<unknown>> = new Map();

  states: Map<string, FakeActiveUserState<unknown>> = new Map();

  constructor(public accountService: FakeAccountService) {
    this.activeUserId$ = accountService.activeAccountSubject.asObservable().pipe(map((a) => a?.id));
  }

  get<T>(keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>): ActiveUserState<T> {
    if (keyDefinition instanceof KeyDefinition) {
      keyDefinition = UserKeyDefinition.fromBaseKeyDefinition(keyDefinition);
    }
    const cacheKey = `${keyDefinition.fullName}_${keyDefinition.stateDefinition.defaultStorageLocation}`;
    let result = this.states.get(cacheKey);

    if (result == null) {
      // Look for established mock
      if (this.establishedMocks.has(keyDefinition.key)) {
        result = this.establishedMocks.get(keyDefinition.key);
      } else {
        result = new FakeActiveUserState<T>(this.accountService);
      }
      result.keyDefinition = keyDefinition;
      this.states.set(cacheKey, result);
    }
    return result as ActiveUserState<T>;
  }

  getFake<T>(keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>): FakeActiveUserState<T> {
    return this.get(keyDefinition) as FakeActiveUserState<T>;
  }

  mockFor<T>(keyDefinitionKey: string, initialValue?: T): FakeActiveUserState<T> {
    if (!this.establishedMocks.has(keyDefinitionKey)) {
      this.establishedMocks.set(
        keyDefinitionKey,
        new FakeActiveUserState<T>(this.accountService, initialValue),
      );
    }
    return this.establishedMocks.get(keyDefinitionKey) as FakeActiveUserState<T>;
  }
}

export class FakeStateProvider implements StateProvider {
  mock = mock<StateProvider>();
  getUserState$<T>(
    keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>,
    userId?: UserId,
  ): Observable<T> {
    if (isUserKeyDefinition(keyDefinition)) {
      this.mock.getUserState$(keyDefinition, userId);
    } else {
      this.mock.getUserState$(keyDefinition, userId);
    }
    if (userId) {
      return this.getUser<T>(userId, keyDefinition).state$;
    }

    return this.getActive(keyDefinition).state$;
  }

  getUserStateOrDefault$<T>(
    keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>,
    config: { userId: UserId | undefined; defaultValue?: T },
  ): Observable<T> {
    const { userId, defaultValue = null } = config;
    if (isUserKeyDefinition(keyDefinition)) {
      this.mock.getUserStateOrDefault$(keyDefinition, config);
    } else {
      this.mock.getUserStateOrDefault$(keyDefinition, config);
    }
    if (userId) {
      return this.getUser<T>(userId, keyDefinition).state$;
    }

    return this.activeUserId$.pipe(
      take(1),
      switchMap((userId) =>
        userId != null ? this.getUser(userId, keyDefinition).state$ : of(defaultValue),
      ),
    );
  }

  async setUserState<T>(
    keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>,
    value: T,
    userId?: UserId,
  ): Promise<[UserId, T]> {
    await this.mock.setUserState(keyDefinition, value, userId);
    if (userId) {
      return [userId, await this.getUser(userId, keyDefinition).update(() => value)];
    } else {
      return await this.getActive(keyDefinition).update(() => value);
    }
  }

  getActive<T>(keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>): ActiveUserState<T> {
    return this.activeUser.get(keyDefinition);
  }

  getGlobal<T>(keyDefinition: KeyDefinition<T>): GlobalState<T> {
    return this.global.get(keyDefinition);
  }

  getUser<T>(
    userId: UserId,
    keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>,
  ): SingleUserState<T> {
    return this.singleUser.get(userId, keyDefinition);
  }

  getDerived<TFrom, TTo, TDeps extends DerivedStateDependencies>(
    parentState$: Observable<TFrom>,
    deriveDefinition: DeriveDefinition<unknown, TTo, TDeps>,
    dependencies: TDeps,
  ): DerivedState<TTo> {
    return this.derived.get(parentState$, deriveDefinition, dependencies);
  }

  constructor(public accountService: FakeAccountService) {}

  global: FakeGlobalStateProvider = new FakeGlobalStateProvider();
  singleUser: FakeSingleUserStateProvider = new FakeSingleUserStateProvider();
  activeUser: FakeActiveUserStateProvider = new FakeActiveUserStateProvider(this.accountService);
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
