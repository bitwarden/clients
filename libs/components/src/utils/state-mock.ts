import { BehaviorSubject, Observable } from "rxjs";

import {
  GlobalState,
  StateUpdateOptions,
  GlobalStateProvider,
  KeyDefinition,
} from "@bitwarden/state";

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
