import { Observable } from "rxjs";
import { Jsonify } from "type-fest";

import { KeyDefinition, StateUpdateOptions, StorageKey } from "@bitwarden/state";
import { AbstractStorageService } from "@bitwarden/storage-core";

export async function getStoredValue<T>(
  key: string,
  storage: AbstractStorageService,
  deserializer: (jsonValue: Jsonify<T>) => T | null,
) {
  if (storage.valuesRequireDeserialization) {
    const jsonValue = await storage.get<Jsonify<T>>(key);
    return deserializer(jsonValue);
  } else {
    const value = await storage.get<T>(key);
    return value ?? null;
  }
}

/**
 * Creates a {@link StorageKey}
 * @param keyDefinition The key definition of which data the key should point to.
 * @returns A key that is ready to be used in a storage service to get data.
 */
export function globalKeyBuilder(keyDefinition: KeyDefinition<unknown>): StorageKey {
  return `global_${keyDefinition.stateDefinition.name}_${keyDefinition.key}` as StorageKey;
}

export const DEFAULT_OPTIONS = {
  shouldUpdate: () => true,
  combineLatestWith: null as Observable<unknown>,
  msTimeout: 1000,
};

export function populateOptionsWithDefault<T, TCombine>(
  options: Partial<StateUpdateOptions<T, TCombine>>,
): StateUpdateOptions<T, TCombine> {
  const { combineLatestWith = null, shouldUpdate = () => true, msTimeout = 1000 } = options;
  return {
    combineLatestWith: combineLatestWith,
    shouldUpdate: shouldUpdate,
    msTimeout: msTimeout,
  };
}
