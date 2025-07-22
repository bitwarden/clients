// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  defer,
  filter,
  firstValueFrom,
  merge,
  Observable,
  ReplaySubject,
  share,
  switchMap,
  tap,
  timeout,
  timer,
} from "rxjs";
import { Jsonify } from "type-fest";

import { AbstractStorageService, ObservableStorageService } from "@bitwarden/storage-core";

import { StorageKey } from "../../../types/state";
import { LogService } from "../../abstractions/log.service";
import { DebugOptions } from "../key-definition";
import { populateOptionsWithDefault, StateUpdateOptions } from "../state-update-options";

import { getStoredValue } from "./util";

// The parts of a KeyDefinition this class cares about to make it work
type KeyDefinitionRequirements<T> = {
  deserializer: (jsonState: Jsonify<T>) => T | null;
  cleanupDelayMs: number;
  debug: Required<DebugOptions>;
};

export abstract class StateBase<T, KeyDef extends KeyDefinitionRequirements<T>> {
  private updatePromise: Promise<T>;

  readonly state$: Observable<T | null>;

  constructor(
    protected readonly key: StorageKey,
    protected readonly storageService: AbstractStorageService & ObservableStorageService,
    protected readonly keyDefinition: KeyDef,
    protected readonly logService: LogService,
  ) {
    const storageUpdate$ = storageService.updates$.pipe(
      filter((storageUpdate) => storageUpdate.key === key),
      switchMap(async (storageUpdate) => {
        if (storageUpdate.updateType === "remove") {
          return null;
        }

        return await getStoredValue(key, storageService, keyDefinition.deserializer);
      }),
    );

    let state$ = merge(
      defer(() => getStoredValue(key, storageService, keyDefinition.deserializer)),
      storageUpdate$,
    );

    if (keyDefinition.debug.enableRetrievalLogging) {
      state$ = state$.pipe(
        tap({
          next: (v) => {
            this.logService.info(
              `Retrieving '${key}' from storage, value is ${v == null ? "null" : "non-null"}`,
            );
          },
        }),
      );
    }

    // If 0 cleanup is chosen, treat this as absolutely no cache
    if (keyDefinition.cleanupDelayMs !== 0) {
      state$ = state$.pipe(
        share({
          connector: () => new ReplaySubject(1),
          resetOnRefCountZero: () => timer(keyDefinition.cleanupDelayMs),
        }),
      );
    }

    this.state$ = state$;
  }

  async update<TCombine>(
    configureState: (state: T | null, dependency: TCombine) => T | null,
    options: StateUpdateOptions<T, TCombine> = {},
  ): Promise<T | null> {
    options = populateOptionsWithDefault(options);
    if (this.updatePromise != null) {
      await this.updatePromise;
    }

    try {
      this.updatePromise = this.internalUpdate(configureState, options);
      return await this.updatePromise;
    } finally {
      this.updatePromise = null;
    }
  }

  private async internalUpdate<TCombine>(
    configureState: (state: T | null, dependency: TCombine) => T | null,
    options: StateUpdateOptions<T, TCombine>,
  ): Promise<T | null> {
    const currentState = await this.getStateForUpdate();
    const combinedDependencies =
      options.combineLatestWith != null
        ? await firstValueFrom(options.combineLatestWith.pipe(timeout(options.msTimeout)))
        : null;

    if (!options.shouldUpdate(currentState, combinedDependencies)) {
      return currentState;
    }

    const newState = configureState(currentState, combinedDependencies);
    await this.doStorageSave(newState, currentState);
    return newState;
  }

  protected async doStorageSave(newState: T | null, oldState: T) {
    if (this.keyDefinition.debug.enableUpdateLogging) {
      this.logService.info(
        `Updating '${this.key}' from ${oldState == null ? "null" : "non-null"} to ${newState == null ? "null" : "non-null"}`,
      );
    }
    await this.storageService.save(this.key, newState);
  }

  /** For use in update methods, does not wait for update to complete before yielding state.
   * The expectation is that that await is already done
   */
  private async getStateForUpdate() {
    return await getStoredValue(this.key, this.storageService, this.keyDefinition.deserializer);
  }
}
