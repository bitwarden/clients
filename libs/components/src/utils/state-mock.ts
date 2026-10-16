import { BehaviorSubject, Observable, map } from "rxjs";

import {
  ActiveUserState,
  CombinedState,
  DerivedState,
  GlobalState,
  StateUpdateOptions,
  GlobalStateProvider,
  KeyDefinition,
  SingleUserState,
  StateProvider,
  UserKeyDefinition,
  activeMarker,
} from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

/** The single account every Storybook story runs as. */
const STORYBOOK_USER_ID = "storybook-user" as UserId;

export class StorybookGlobalState<T> implements GlobalState<T> {
  private _state$ = new BehaviorSubject<T | null>(null);

  constructor(initialValue?: T | null) {
    this._state$.next(initialValue ?? null);
  }

  async update<TCombine>(
    configureState: (state: T | null, dependency: TCombine) => T | null,
    options?: Partial<StateUpdateOptions<T, TCombine>>,
  ): Promise<T | null> {
    const currentState = this._state$.value;
    const newState = configureState(currentState, null as TCombine);
    this._state$.next(newState);
    return newState;
  }

  get state$(): Observable<T | null> {
    return this._state$.asObservable();
  }

  setValue(value: T | null): void {
    this._state$.next(value);
  }
}

export class StorybookGlobalStateProvider implements GlobalStateProvider {
  private states = new Map<string, StorybookGlobalState<any>>();

  get<T>(keyDefinition: KeyDefinition<T>): GlobalState<T> {
    const key = `${keyDefinition.fullName}_${keyDefinition.stateDefinition.defaultStorageLocation}`;

    if (!this.states.has(key)) {
      this.states.set(key, new StorybookGlobalState<T>());
    }

    return this.states.get(key)!;
  }
}

/** The active-user analogue of {@link StorybookGlobalState}. */
export class StorybookActiveUserState<T> implements ActiveUserState<T> {
  readonly [activeMarker] = true as const;

  private readonly _state$: BehaviorSubject<T | null>;

  constructor(initialValue?: T | null) {
    this._state$ = new BehaviorSubject<T | null>(initialValue ?? null);
  }

  get state$(): Observable<T | null> {
    return this._state$.asObservable();
  }

  get combinedState$(): Observable<CombinedState<T | null>> {
    return this._state$.pipe(map((state) => [STORYBOOK_USER_ID, state] as CombinedState<T | null>));
  }

  async update<TCombine>(
    configureState: (state: T | null, dependency: TCombine) => T | null,
    options?: Partial<StateUpdateOptions<T, TCombine>>,
  ): Promise<[UserId, T | null]> {
    const newState = configureState(this._state$.value, null as TCombine);
    this._state$.next(newState);
    return [STORYBOOK_USER_ID, newState];
  }

  setValue(value: T | null): void {
    this._state$.next(value);
  }
}

/**
 * The per-user counterpart to {@link StorybookGlobalStateProvider}. Only the active-user
 * surface is implemented — that is all the component library reaches for. Seed a story's
 * starting state with {@link getActive} before rendering.
 */
export class StorybookStateProvider implements StateProvider {
  readonly activeUserId$: Observable<UserId | undefined> = new BehaviorSubject<UserId | undefined>(
    STORYBOOK_USER_ID,
  ).asObservable();

  private readonly states = new Map<string, StorybookActiveUserState<any>>();

  getActive<T>(userKeyDefinition: UserKeyDefinition<T>): ActiveUserState<T> {
    const key = userKeyDefinition.fullName;
    let state = this.states.get(key);
    if (!state) {
      state = new StorybookActiveUserState<T>();
      this.states.set(key, state);
    }
    return state;
  }

  getUserState$<T>(): Observable<T> {
    throw new Error("StorybookStateProvider: getUserState$ is not implemented.");
  }

  getUserStateOrDefault$<T>(): Observable<T> {
    throw new Error("StorybookStateProvider: getUserStateOrDefault$ is not implemented.");
  }

  setUserState<T>(): Promise<[UserId, T | null]> {
    throw new Error("StorybookStateProvider: setUserState is not implemented.");
  }

  getUser<T>(): SingleUserState<T> {
    throw new Error("StorybookStateProvider: getUser is not implemented.");
  }

  getGlobal<T>(): GlobalState<T> {
    throw new Error("StorybookStateProvider: getGlobal is not implemented.");
  }

  getDerived<TTo>(): DerivedState<TTo> {
    throw new Error("StorybookStateProvider: getDerived is not implemented.");
  }
}
